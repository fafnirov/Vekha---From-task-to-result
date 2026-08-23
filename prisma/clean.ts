/**
 * Удаление содержимого рабочего пространства.
 *
 * Убирает всё, что наполняет трекер: задачи, проекты, спринты, очереди,
 * команды, комментарии, вложения, историю, уведомления и учётные записи.
 * Каркас остаётся нетронутым — права, поля, колонки доски, воркфлоу и
 * шаблоны нужны, чтобы приложение осталось работоспособным.
 *
 *   npm run db:clean -- --yes              очистить полностью
 *   npm run db:clean -- --yes --keep-users оставить участников
 *
 * После полной очистки в базе нет ни одного пользователя, поэтому
 * первый, кто зарегистрируется, снова станет администратором.
 */

import { PrismaClient } from '@prisma/client'
import { readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { UPLOAD_DIR } from '../server/lib/paths.js'

const prisma = new PrismaClient()

const YES = process.argv.includes('--yes')
const KEEP_USERS = process.argv.includes('--keep-users')

async function main() {
  const before = {
    задачи: await prisma.task.count(),
    проекты: await prisma.project.count(),
    очереди: await prisma.queue.count(),
    спринты: await prisma.sprint.count(),
    команды: await prisma.team.count(),
    участники: await prisma.user.count(),
  }

  if (!YES) {
    console.log('Будет удалено:', before)
    console.log(
      KEEP_USERS
        ? 'Участники сохранятся.'
        : 'Участники тоже будут удалены — первый зарегистрировавшийся станет админом.',
    )
    console.log('\nЭто необратимо. Повторите с флагом --yes, если согласны.')
    return
  }

  /* Порядок важен: сначала то, что ссылается на другое. */
  await prisma.burndownPoint.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.activity.deleteMany()
  await prisma.worklog.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.watcher.deleteMany()
  await prisma.taskLink.deleteMany()
  await prisma.taskTag.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.task.deleteMany()
  await prisma.milestone.deleteMany()
  await prisma.project.deleteMany()
  await prisma.sprint.deleteMany()
  await prisma.savedFilter.deleteMany()
  await prisma.automationRule.deleteMany()
  await prisma.queue.deleteMany()
  await prisma.teamMember.deleteMany()
  await prisma.team.deleteMany()
  await prisma.invite.deleteMany()

  if (!KEEP_USERS) {
    await prisma.user.deleteMany()
    // Название организации задаётся при наполнении, поэтому тоже сбрасываем.
    await prisma.organization.deleteMany()
  }

  /* Файлы вложений: записи удалены, сами файлы остались бы мусором. */
  let files = 0
  if (existsSync(UPLOAD_DIR)) {
    for (const name of await readdir(UPLOAD_DIR)) {
      await rm(`${UPLOAD_DIR}/${name}`, { force: true, recursive: true })
      files += 1
    }
  }

  const after = {
    задачи: await prisma.task.count(),
    проекты: await prisma.project.count(),
    очереди: await prisma.queue.count(),
    участники: await prisma.user.count(),
  }

  const kept = {
    права: await prisma.rolePermission.count(),
    поля: await prisma.taskField.count(),
    колонкиДоски: await prisma.boardColumn.count(),
    воркфлоу: await prisma.workflow.count(),
    шаблоны: await prisma.taskTemplate.count(),
  }

  console.log('Удалено. Осталось содержимого:', after)
  console.log('Каркас сохранён:', kept)
  if (files) console.log(`Удалено файлов вложений: ${files}`)
  if (!KEEP_USERS) {
    console.log('\nПользователей нет: откройте приложение и зарегистрируйтесь — станете администратором.')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
