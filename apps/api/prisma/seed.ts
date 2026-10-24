import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const reset = process.argv.includes("--reset");
  const demo = process.argv.includes("--demo");
  const inspect = process.argv.includes("--inspect");
  if (reset && demo) {
    throw new Error("Không thể tạo dữ liệu mẫu khi đặt lại dữ liệu để sử dụng thật.");
  }
  if (inspect) {
    const databaseUrl = new URL(process.env.DATABASE_URL!);
    const [users, admins, rooms, bookings, series] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.room.count(),
      prisma.booking.count(),
      prisma.bookingSeries.count()
    ]);
    console.log(JSON.stringify({ host: databaseUrl.hostname, database: databaseUrl.pathname.slice(1), users, admins, rooms, bookings, series }));
    return;
  }
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (Boolean(adminEmail) !== Boolean(adminPassword)) {
    throw new Error("Cần cấu hình đồng thời ADMIN_EMAIL và ADMIN_PASSWORD để tạo quản trị viên.");
  }

  if (reset && (!adminEmail || !adminPassword)) {
    throw new Error("Cần cấu hình ADMIN_EMAIL và ADMIN_PASSWORD trước khi đặt lại dữ liệu.");
  }

  const passwordHash = adminPassword ? await bcrypt.hash(adminPassword, 12) : undefined;
  const seedAdmin = async (transaction: Prisma.TransactionClient) => {
    if (!adminEmail || !passwordHash) return;
    await transaction.user.upsert({
      where: { email: adminEmail },
      update: {
        name: process.env.ADMIN_NAME ?? "Roomly Admin",
        passwordHash,
        role: "ADMIN",
        ...(process.env.ADMIN_DEPARTMENT?.trim() ? { department: process.env.ADMIN_DEPARTMENT.trim() } : {}),
        isActive: true,
        mustChangePassword: false
      },
      create: {
        name: process.env.ADMIN_NAME ?? "Roomly Admin",
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
        department: process.env.ADMIN_DEPARTMENT?.trim() || "Quản trị hệ thống"
      }
    });
  };

  await prisma.$transaction(async (transaction) => {
    if (reset) {
      await transaction.booking.deleteMany();
      await transaction.bookingSeries.deleteMany();
      await transaction.room.deleteMany();
      await transaction.user.deleteMany();
    }
    await seedAdmin(transaction);
    if (demo) {
      await transaction.room.createMany({
        data: [
          { name: "Orchid", nameKo: "오키드 회의실", capacity: 8, location: "Tầng 2" },
          { name: "Lotus", nameKo: "로터스 회의실", capacity: 12, location: "Tầng 3" },
          { name: "Bamboo", nameKo: "뱀부 회의실", capacity: 6, location: "Tầng 1" }
        ],
        skipDuplicates: true
      });
    }
  }, { timeout: 30000 });
  console.log(reset ? "Đã đặt lại dữ liệu và tạo tài khoản quản trị. Không tạo dữ liệu mẫu." : "Đã seed dữ liệu khởi tạo.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
