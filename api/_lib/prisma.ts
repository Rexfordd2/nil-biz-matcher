import { PrismaClient } from '@prisma/client'

type GlobalWithPrisma = typeof globalThis & { prisma?: PrismaClient | null }
const globalForPrisma = globalThis as GlobalWithPrisma

function createPrismaClientSafely(): PrismaClient | null {
	try {
		return new PrismaClient({
			log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
		})
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error('Prisma initialization error (continuing without DB):', error)
		return null
	}
}

export const prisma: PrismaClient | null =
	globalForPrisma.prisma ?? createPrismaClientSafely()

if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma === undefined) {
	globalForPrisma.prisma = prisma
}

export default prisma

