// dotenv.config();
import { prisma } from '@project/db';
// import dotenv from 'dotenv';



async function testConnection() {
  console.log("📡 Attempting direct database handshake...");
  try {
    const result = await prisma.$queryRaw`SELECT 1 as connection_status`;
    console.log("✅ SUCCESS! The database is accessible from the worker layer:", result);
  } catch (error: any) {
    console.error("❌ Handshake Failed!");
    console.error("Error Code:", error.code);
    console.log(process.env.DATABASE_URL);
    console.error("System Error Message:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();