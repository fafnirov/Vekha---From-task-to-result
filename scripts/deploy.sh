#!/usr/bin/env bash
#
# Выкатка Vekha на сервере.
#
# Запускается на самой машине одной командой:
#
#     ssh nuvio /opt/vekha/app/scripts/deploy.sh
#
# Раньше выкатка была цепочкой отдельных ssh-подключений. Помимо
# неудобства это приводило к блокировке по числу подключений: сервер
# закрывал порт 22 на подходе, и выкатка вставала посреди дела.
#
# Скрипт останавливается на первой же ошибке и перезапускает службу
# только после успешной сборки: сломанная сборка не должна заменять
# работающее приложение.
#
# Автоматического отката нет намеренно. Миграции базы назад не
# отматываются, и «откат» кода при уже применённой миграции оставил бы
# приложение в состоянии хуже, чем упавшая выкатка. При провале скрипт
# показывает, что случилось, и называет прежнюю ревизию.

set -euo pipefail

# --no-pull: код уже доставлен другим способом (например, git-свёртком по
# SSH, когда на машине не работает разрешение имён). Остальные шаги те же.
SKIP_PULL=no
[ "${1:-}" = "--no-pull" ] && SKIP_PULL=yes

APP_DIR=/opt/vekha/app
BACKUP_DIR=/opt/vekha/backups
SERVICE=vekha
HEALTH_URL=http://127.0.0.1:3100/api/auth/state

# Сколько копий базы держим. Старые удаляются, иначе каталог растёт молча.
KEEP_BACKUPS=10

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mВыкатка прервана: %s\033[0m\n' "$1" >&2; exit 1; }

# Работаем только в своём каталоге: рядом боевая LMS.
[ -d "$APP_DIR" ] || fail "нет каталога $APP_DIR"
cd "$APP_DIR"
[ -f package.json ] || fail "$APP_DIR не похож на каталог приложения"

BEFORE=$(git rev-parse --short HEAD)


step "Обновление кода"
#
# Резолвер на этой машине отвечает через раз: git pull падает на
# «Could not resolve host: github.com», хотя следом та же команда
# проходит. Пробуем несколько раз, прежде чем сдаться, — иначе выкатка
# срывается на ровном месте.
#
if [ "$SKIP_PULL" = yes ]; then
  echo "пропускаю: код доставлен отдельно"
else
  PULLED=no
  for attempt in 1 2 3 4 5; do
    if git pull --ff-only; then
      PULLED=yes
      break
    fi
    echo "попытка $attempt не удалась, жду 5 с"
    sleep 5
  done
  [ "$PULLED" = yes ] || fail "не удалось получить код из репозитория за 5 попыток"
fi

AFTER=$(git rev-parse --short HEAD)
if [ "$BEFORE" = "$AFTER" ]; then
  echo "новых коммитов нет ($AFTER) — пересобираю на всякий случай"
else
  echo "$BEFORE -> $AFTER"
fi

step "Зависимости"
npm install --no-audit --no-fund

step "Копия базы"
DB_FILE=$(ls prisma/*.db 2>/dev/null | head -1 || true)
if [ -n "$DB_FILE" ]; then
  sudo mkdir -p "$BACKUP_DIR"
  STAMP=$(date +%Y%m%d-%H%M%S)
  sudo cp "$DB_FILE" "$BACKUP_DIR/vekha-$STAMP.db"
  echo "сохранена как vekha-$STAMP.db"
  # Оставляем только последние KEEP_BACKUPS копий. `|| true` — потому что
  # при pipefail неудачная выборка оборвала бы выкатку, хотя чистка
  # старых копий к её успеху отношения не имеет.
  sudo ls -1t "$BACKUP_DIR"/vekha-*.db 2>/dev/null \
    | tail -n +$((KEEP_BACKUPS + 1)) \
    | xargs -r sudo rm -- || true
else
  echo "файл базы не найден — пропускаю"
fi

step "База и клиент Prisma"
npm run db:deploy
# Обязательно после миграций: db:deploy клиент не пересобирает, и сборка
# падает на моделях, которых клиент ещё не знает.
npx prisma generate

step "Сборка"
npm run build

step "Перезапуск службы"
sudo systemctl restart "$SERVICE"

step "Проверка"
for i in $(seq 1 15); do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "приложение отвечает (попытка $i)"
    printf '\n\033[32mГотово: %s\033[0m\n' "$(git log --oneline -1)"
    exit 0
  fi
  sleep 1
done

# Не поднялось — показываем причину, чтобы не лезть за ней вторым заходом.
printf '\n\033[31mСлужба не отвечает на %s\033[0m\n' "$HEALTH_URL" >&2
systemctl is-active "$SERVICE" >&2 || true
sudo journalctl -u "$SERVICE" -n 30 --no-pager >&2 || true
fail "прежняя ревизия была $BEFORE"
