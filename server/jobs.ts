/**
 * Фоновые задания: ежедневный срез burndown и запуск правил по расписанию.
 * Планировщика в проекте нет намеренно — таймер внутри процесса покрывает
 * потребности одного сервера и не добавляет зависимостей.
 */

import { prisma } from './lib/prisma.js'
import { runScheduledRules } from './lib/automation.js'
import { startOfDay } from './lib/format.js'

/** Записывает остаток story points активных спринтов на сегодня. */
export async function snapshotBurndown(): Promise<number> {
  const sprints = await prisma.sprint.findMany({
    where: { state: 'active' },
    include: { tasks: { include: { status: { select: { category: true } } } } },
  })

  const day = startOfDay(new Date())
  let written = 0

  for (const sprint of sprints) {
    if (day < startOfDay(sprint.startDate) || day > sprint.endDate) continue

    const total = sprint.tasks.reduce((sum, t) => sum + (t.estimate ?? 0), 0)
    const remaining = sprint.tasks
      .filter((t) => t.status.category !== 'done')
      .reduce((sum, t) => sum + (t.estimate ?? 0), 0)

    const span = Math.max(
      1,
      Math.round((sprint.endDate.getTime() - startOfDay(sprint.startDate).getTime()) / 86_400_000),
    )
    const elapsed = Math.round((day.getTime() - startOfDay(sprint.startDate).getTime()) / 86_400_000)
    const ideal = Math.max(0, Math.round(total * (1 - elapsed / span)))

    await prisma.burndownPoint.upsert({
      where: { sprintId_day: { sprintId: sprint.id, day } },
      create: { sprintId: sprint.id, day, remaining, ideal },
      update: { remaining, ideal },
    })
    written += 1
  }

  return written
}

const HOUR = 60 * 60 * 1000

/**
 * Раз в час проверяем, наступил ли новый день; если да — снимаем срез
 * и прогоняем правила с расписанием. Простая проверка вместо cron
 * переживает перезапуск процесса в любой момент суток.
 */
export function startDailyJobs(): () => void {
  let lastRun = ''

  const tick = async () => {
    const stamp = startOfDay(new Date()).toISOString()
    if (stamp === lastRun) return
    lastRun = stamp
    try {
      await snapshotBurndown()
      const fired = await runScheduledRules()
      if (fired) console.log(`Автоматизации по расписанию: ${fired} срабатываний`)
    } catch (err) {
      console.error('Ошибка фонового задания:', err)
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), HOUR)
  timer.unref?.()

  return () => clearInterval(timer)
}
