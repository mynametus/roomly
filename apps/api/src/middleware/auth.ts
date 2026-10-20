import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "USER" | "ADMIN";
    mustChangePassword?: boolean;
    isActive?: boolean;
  };
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError("Máy chủ chưa cấu hình JWT_SECRET đủ an toàn.", 500);
  }
  return secret;
}

export function createToken(user: {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  mustChangePassword?: boolean;
}): string {
  return jwt.sign(user, jwtSecret(), { expiresIn: "12h" });
}

export async function requireAuth(
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction
): Promise<void> {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    next(new AppError("Vui lòng đăng nhập để tiếp tục.", 401));
    return;
  }

  let secret: string;
  try {
    secret = jwtSecret();
  } catch (error) {
    next(error);
    return;
  }

  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(authorization.slice(7), secret);
    if (typeof verified === "string" || typeof verified.id !== "string") {
      throw new Error("Invalid token payload");
    }
    payload = verified;
  } catch {
    next(new AppError("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.", 401));
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, role: true, mustChangePassword: true, isActive: true }
  });
  if (!user || !user.isActive) {
    next(new AppError("Tài khoản đã bị khóa hoặc không còn tồn tại.", 401));
    return;
  }
  request.user = user;
  next();
}

export function requireAdmin(
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction
): void {
  if (request.user?.role !== "ADMIN") {
    next(new AppError("Bạn không có quyền thực hiện thao tác này.", 403));
    return;
  }
  next();
}

export function requirePasswordChanged(
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction
): void {
  if (request.user?.mustChangePassword) {
    next(new AppError("Bạn cần đổi mật khẩu trước khi tiếp tục.", 403));
    return;
  }
  next();
}
