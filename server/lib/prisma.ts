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
