import { PrismaClient } from '@prisma/client'

/**
 * Один экземпляр клиента на процесс. В dev-режиме tsx перезапускает модуль,
 * поэтому кэшируем клиента в globalThis, чтобы не плодить соединения.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/*
 * Режим журнала и ожидание блокировки.
 *
 * По умолчанию SQLite пишет через откатный журнал: пишущий закрывает
 * базу для читающих, и при одновременной работе команды запрос падает с
 * «database is locked» вместо того, чтобы подождать. WAL разводит чтение
 * и запись, а busy_timeout даёт запросу пять секунд подождать своей
 * очереди — этого с запасом хватает на десяток человек и фоновые
 * задания по расписанию.
 *
 * Выполняется один раз при старте; ошибки не глушат приложение, но
 * сообщаются: работать без WAL можно, молчать об этом — нет.
 */
export async function tuneDatabase(): Promise<void> {
  try {
    // journal_mode отвечает выбранным режимом, поэтому запрашивается как
    // чтение: $executeRaw на ответ ругается «results not allowed».
    const mode = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>(
      'PRAGMA journal_mode = WAL',
    )
    // busy_timeout тоже отвечает установленным значением.
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000')
    await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL')
    const got = mode?.[0]?.journal_mode
    if (got && got.toLowerCase() !== 'wal') {
      console.warn(`База осталась в режиме журнала ${got}, а не WAL`)
    }
  } catch (err) {
    console.warn('Не удалось настроить базу:', err instanceof Error ? err.message : err)
  }
}
