import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Query logging is very noisy (every request logs several statements), so it
// is opt-in via PRISMA_LOG_QUERIES=1. Warnings and errors are always logged.
const logLevels: ('query' | 'warn' | 'error')[] =
  process.env.PRISMA_LOG_QUERIES === '1' ? ['query', 'warn', 'error'] : ['warn', 'error']

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevels,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
