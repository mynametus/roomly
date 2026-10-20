import { randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, type AuthenticatedRequest } from "../middleware/auth.js";
import { bulkUsersSchema } from "../lib/validation.js";

export const usersRouter = Router();

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

  const credentials = await Promise.all(users.map(async (user) => {
    const temporaryPassword = randomBytes(24).toString("base64url");
    return {
      name: user.name,
      email: user.email,
      passwordHash: await bcrypt.hash(temporaryPassword, 10),
      temporaryPassword
    };
  }));
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
      data: credentials.map(({ name, email, passwordHash }) => ({
        name,
        email,
        passwordHash,
        role: "USER" as const
      }))
    });
  });

  response.status(201).json({
    created: credentials.map(({ name, email, temporaryPassword }) => ({
      name,
      email,
      temporaryPassword
    }))
  });
});
