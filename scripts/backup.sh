#!/usr/bin/env bash
#
# Резервная копия трекера. Запускается на сервере, обычно по расписанию:
#
#     /srv/projects/tracker/scripts/backup.sh
#
# Что делает:
#   1. снимает согласованный снимок базы средствами самой SQLite;
#   2. проверяет его целостность — битая копия не считается сделанной;
#   3. складывает вложения, если они есть;
#   4. удаляет копии старше срока хранения.
#
# Почему не `cp` файла базы. Приложение пишет в неё непрерывно, и обычное
# копирование может застать запись на середине: получится файл, который
# откроется, но окажется повреждён — и узнаешь об этом в худший день.
# `VACUUM INTO` просит саму SQLite отдать целостный снимок.
#
# Скрипт заканчивается ненулевым кодом при любой неудаче: расписание
# systemd тогда пометит запуск как сбойный, и молчаливой потери копий не
# будет.

set -euo pipefail

APP_DIR=/srv/projects/tracker
BACKUP_DIR="$APP_DIR/backups"
DATA_DIR="$APP_DIR/data"
SERVICE=app

# Сколько дней держим копии. При объёме в сотни килобайт это ничего не
# стоит, а глубина спасает от беды, замеченной не сразу.
KEEP_DAYS=30

STAMP=$(date +%Y%m%d-%H%M%S)

say() { printf '%s  %s\n' "$(date '+%H:%M:%S')" "$1"; }
die() { printf '%s  ОШИБКА: %s\n' "$(date '+%H:%M:%S')" "$1" >&2; exit 1; }

cd "$APP_DIR" || die "нет каталога $APP_DIR"
mkdir -p "$BACKUP_DIR"

docker compose ps --status running --format '{{.Service}}' | grep -qx "$SERVICE" \
  || die "контейнер $SERVICE не запущен — копию снимать не с чего"

# ── Снимок ──────────────────────────────────────────────────────────────
# Пишем внутрь тома: каталог data подключён с хоста, поэтому файл сразу
# виден снаружи.
say "снимаю снимок базы"
docker compose exec -T "$SERVICE" node -e '
const { PrismaClient } = require("@prisma/client")
const fs = require("node:fs")
const p = new PrismaClient()
;(async () => {
  fs.rmSync("/data/.snapshot.db", { force: true })
  await p.$executeRawUnsafe("VACUUM INTO \x27/data/.snapshot.db\x27")
  const bad = await p.$queryRawUnsafe("PRAGMA integrity_check")
  const verdict = Object.values(bad[0])[0]
  if (verdict !== "ok") { console.error("целостность: " + verdict); process.exit(1) }
  console.log("снимок снят и проверен")
  await p.$disconnect()
})().catch((e) => { console.error(e.message); process.exit(1) })
' || die "не удалось снять снимок"

SNAP="$DATA_DIR/.snapshot.db"
[ -s "$SNAP" ] || die "снимок пуст или не создан"

# ── Проверка снимка отдельно от приложения ─────────────────────────────
# Открываем скопированный файл как самостоятельную базу: если он бит,
# лучше узнать сейчас, а не при восстановлении.
say "проверяю снимок как отдельную базу"
docker compose exec -T "$SERVICE" node -e '
const { PrismaClient } = require("@prisma/client")
const p = new PrismaClient({ datasources: { db: { url: "file:/data/.snapshot.db" } } })
;(async () => {
  const users = await p.user.count()
  const tasks = await p.task.count()
  console.log(`в снимке: пользователей ${users}, задач ${tasks}`)
  await p.$disconnect()
})().catch((e) => { console.error(e.message); process.exit(1) })
' || die "снимок не открывается как база"

TARGET="$BACKUP_DIR/tracker-$STAMP.db"
mv "$SNAP" "$TARGET"
say "база сохранена: $(basename "$TARGET") ($(du -h "$TARGET" | cut -f1))"

# ── Вложения ────────────────────────────────────────────────────────────
if [ -d "$DATA_DIR/uploads" ] && [ -n "$(ls -A "$DATA_DIR/uploads" 2>/dev/null)" ]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$DATA_DIR" uploads
  say "вложения сохранены ($(du -h "$BACKUP_DIR/uploads-$STAMP.tar.gz" | cut -f1))"
else
  say "вложений нет — пропускаю"
fi

# ── Срок хранения ───────────────────────────────────────────────────────
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'tracker-*.db' -o -name 'uploads-*.tar.gz' \) \
  -mtime +$KEEP_DAYS -print -delete | wc -l)
[ "$DELETED" -gt 0 ] && say "удалено старше $KEEP_DAYS дней: $DELETED"

say "готово. копий в хранилище: $(find "$BACKUP_DIR" -maxdepth 1 -name 'tracker-*.db' | wc -l)"
