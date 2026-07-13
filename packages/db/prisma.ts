import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import {  PrismaClient } from './generated/prisma/index.js'

// console.log(UploadStatus);

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// setup the driver for Neon/Postgres
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

// Pass the adapter as the required argument
export const prisma =
  globalForPrisma.prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma