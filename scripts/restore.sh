#!/usr/bin/env bash
#
# Восстановление трекера из копии.
#
#     scripts/restore.sh                       — показать, что есть
#     scripts/restore.sh tracker-20260904-041700.db
#
# Копия, из которой ни разу не поднимались, — не копия, а надежда.
# Поэтому процедура записана скриптом и её можно прогнать в любой день,
# а не сочинять под давлением в день аварии.
#
# Перед заменой скрипт откладывает нынешнюю базу рядом: если копия
# окажется не той, вернуться будет куда.

set -euo pipefail

APP_DIR=/srv/projects/tracker
BACKUP_DIR="$APP_DIR/backups"
DATA_DIR="$APP_DIR/data"
SERVICE=app

say() { printf '%s  %s\n' "$(date '+%H:%M:%S')" "$1"; }
die() { printf '%s  ОШИБКА: %s\n' "$(date '+%H:%M:%S')" "$1" >&2; exit 1; }

cd "$APP_DIR" || die "нет каталога $APP_DIR"

if [ $# -eq 0 ]; then
  echo "Доступные копии (свежие сверху):"
  ls -1t "$BACKUP_DIR"/tracker-*.db 2>/dev/null | head -20 | while read -r f; do
    printf '  %-34s %8s  %s\n' "$(basename "$f")" "$(du -h "$f" | cut -f1)" \
      "$(date -r "$f" '+%d.%m.%Y %H:%M')"
  done
  echo
  echo "Восстановить:  $0 <имя файла>"
  exit 0
fi

SRC="$BACKUP_DIR/$(basename "$1")"
[ -f "$SRC" ] || die "копии $SRC нет"

# ── Проверяем копию ДО того, как трогать рабочую базу ───────────────────
say "проверяю копию перед восстановлением"
cp "$SRC" "$DATA_DIR/.restore-check.db"
docker compose exec -T "$SERVICE" node -e '
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient({ datasources: { db: { url: "file:/data/.restore-check.db" } } })
;(async () => {
  const bad = await p.$queryRawUnsafe("PRAGMA integrity_check")
  const verdict = Object.values(bad[0])[0]
  if (verdict !== "ok") { console.error("целостность: " + verdict); process.exit(1) }
  console.log(`в копии: пользователей ${await p.user.count()}, задач ${await p.task.count()}`)
  await p.$disconnect()
})().catch((e) => { console.error(e.message); process.exit(1) })
' || { rm -f "$DATA_DIR/.restore-check.db"; die "копия непригодна — рабочая база не тронута"; }
rm -f "$DATA_DIR/.restore-check.db"

printf 'Заменить рабочую базу этой копией? Введите «да»: '
read -r answer
[ "$answer" = "да" ] || { say "отменено"; exit 0; }

# ── Замена ──────────────────────────────────────────────────────────────
say "останавливаю приложение"
docker compose stop "$SERVICE"

ASIDE="$BACKUP_DIR/before-restore-$(date +%Y%m%d-%H%M%S).db"
cp "$DATA_DIR/tracker.db" "$ASIDE"
say "нынешняя база отложена: $(basename "$ASIDE")"

cp "$SRC" "$DATA_DIR/tracker.db"
# Хвосты журнала от прежней базы к новой не относятся.
rm -f "$DATA_DIR/tracker.db-wal" "$DATA_DIR/tracker.db-shm" "$DATA_DIR/tracker.db-journal"

say "запускаю приложение"
docker compose start "$SERVICE"

for i in $(seq 1 20); do
  if curl -fsS --max-time 3 http://127.0.0.1:8093/api/auth/state >/dev/null 2>&1; then
    say "приложение отвечает (попытка $i)"
    say "готово. если копия оказалась не та — вернуть: $0 $(basename "$ASIDE")"
    exit 0
  fi
  sleep 2
done

die "приложение не отвечает — смотрите docker compose logs $SERVICE"
