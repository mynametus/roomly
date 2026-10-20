import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (Boolean(adminEmail) !== Boolean(adminPassword)) {
    throw new Error("Cần cấu hình đồng thời ADMIN_EMAIL và ADMIN_PASSWORD để tạo quản trị viên.");
  }

  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: process.env.ADMIN_NAME ?? "Roomly Admin",
        passwordHash,
        role: "ADMIN"
      },
      create: {
        name: process.env.ADMIN_NAME ?? "Roomly Admin",
        email: adminEmail,
        passwordHash,
        role: "ADMIN"
      }
    });
  }

  await prisma.room.createMany({
    data: [
      { name: "Orchid", capacity: 8, location: "Tầng 2" },
      { name: "Lotus", capacity: 12, location: "Tầng 3" },
      { name: "Bamboo", capacity: 6, location: "Tầng 1" }
    ],
    skipDuplicates: true
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
