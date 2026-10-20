import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { changePasswordSchema, loginSchema, registerSchema } from "../lib/validation.js";
import { createToken, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/register", async (request, response) => {
  const input = registerSchema.parse(request.body);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("Email này đã được đăng ký.", 409);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      mustChangePassword: false
    },
    select: { id: true, name: true, email: true, role: true, mustChangePassword: true, isActive: true }
  });
  response.status(201).json({ user, token: createToken(user) });
});

authRouter.post("/login", async (request, response) => {
  const input = loginSchema.parse(request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError("Email hoặc mật khẩu không chính xác.", 401);
  }
  if (!user.isActive) throw new AppError("Tài khoản đã bị khóa. Hãy liên hệ quản trị viên.", 403);
  const publicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive
  };
  response.json({ user: publicUser, token: createToken(publicUser) });
});

authRouter.post("/change-password", requireAuth, async (request, response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
  const userId = (request as AuthenticatedRequest).user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError("Mật khẩu hiện tại không chính xác.", 400);
  }
  if (currentPassword === newPassword) {
    throw new AppError("Mật khẩu mới phải khác mật khẩu hiện tại.", 400);
  }
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      mustChangePassword: false
    },
    select: { id: true, name: true, email: true, role: true, mustChangePassword: true, isActive: true }
  });
  response.json({ user: updatedUser, token: createToken(updatedUser) });
});

authRouter.get("/me", requireAuth, async (request, response) => {
  const userId = (request as AuthenticatedRequest).user!.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, mustChangePassword: true, isActive: true }
  });
  if (!user) throw new AppError("Không tìm thấy tài khoản.", 404);
  response.json({ user });
});
