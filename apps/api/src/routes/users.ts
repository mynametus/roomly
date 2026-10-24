import { randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, type AuthenticatedRequest } from "../middleware/auth.js";
import { bulkUsersSchema, userDepartmentSchema, userStatusSchema } from "../lib/validation.js";

export const usersRouter = Router();

usersRouter.get("/", requireAdmin, async (request, response) => {
  const query = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const users = await prisma.user.findMany({
    where: query ? {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { department: { contains: query, mode: "insensitive" } }
      ]
    } : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      role: true,
      mustChangePassword: true,
      isActive: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
  response.json({ users });
});

usersRouter.patch("/:id/department", requireAdmin, async (request, response) => {
  const { department } = userDepartmentSchema.parse(request.body);
  const userId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!userId) throw new AppError("Thiếu mã tài khoản.");
  const user = await prisma.user.update({
    where: { id: userId },
    data: { department },
    select: { id: true, name: true, email: true, department: true }
  });
  response.json({ user });
});

usersRouter.patch("/:id/status", requireAdmin, async (request, response) => {
  const { isActive } = userStatusSchema.parse(request.body);
  const userId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!userId) throw new AppError("Thiếu mã tài khoản.");
  const admin = (request as AuthenticatedRequest).user!;
  if (!isActive && userId === admin.id) {
    throw new AppError("Bạn không thể tự khóa tài khoản đang sử dụng.");
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: { id: true, name: true, email: true, role: true, isActive: true }
  });
  response.json({ user });
});

usersRouter.post("/:id/reset-password", requireAdmin, async (request, response) => {
  const userId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  if (!userId) throw new AppError("Thiếu mã tài khoản.");
  const temporaryPassword = randomBytes(18).toString("base64url");
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(temporaryPassword, 12),
      mustChangePassword: true
    },
    select: { id: true, name: true, email: true }
  });
  response.json({ user, temporaryPassword });
});

usersRouter.post("/bulk", requireAdmin, async (request, response) => {
  const { users } = bulkUsersSchema.parse(request.body);
  const existing = await prisma.user.findMany({
    where: { email: { in: users.map((user) => user.email) } },
    select: { email: true }
  });
  if (existing.length) {
    throw new AppError(
      `Các email sau đã có tài khoản: ${existing.map((user) => user.email).join(", ")}.`,
      409,
      { existingEmails: existing.map((user) => user.email) }
    );
  }

  const accounts = await Promise.all(users.map(async (user) => ({
    ...user,
    passwordHash: await bcrypt.hash("12345678", 12)
  })));
  const adminId = (request as AuthenticatedRequest).user!.id;

  await prisma.$transaction(async (transaction) => {
    const admin = await transaction.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });
    if (admin?.role !== "ADMIN") {
      throw new AppError("Tài khoản không còn quyền quản trị.", 403);
    }
    await transaction.user.createMany({
      data: accounts.map(({ name, email, department, passwordHash }) => ({
        name,
        email,
        department,
        passwordHash,
        role: "USER" as const,
        mustChangePassword: true
      }))
    });
  });

  response.status(201).json({
    created: users.map(({ name, email, department }) => ({
      name,
      email,
      department
    }))
  });
});
