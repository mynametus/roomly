import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  $transaction: vi.fn()
}));

vi.mock("./lib/prisma.js", () => ({ prisma: prismaMock }));

import app from "./application.js";
import { createToken } from "./middleware/auth.js";

process.env.JWT_SECRET ??= "roomly-test-jwt-secret-that-is-long-enough";

const user = {
  id: "bulk-user",
  name: "Bulk User",
  email: "bulk-user@example.com",
  role: "USER" as const,
  mustChangePassword: true
};

describe("initial password flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates bulk accounts with the default password and forces a change", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (callback) => callback({
      user: {
        findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }),
        createMany: vi.fn().mockImplementation(async ({ data }) => {
          expect(data).toHaveLength(1);
          expect(data[0].role).toBe("USER");
          expect(data[0].mustChangePassword).toBe(true);
          expect(await bcrypt.compare("12345678", data[0].passwordHash)).toBe(true);
          return { count: 1 };
        })
      }
    }));
    const token = createToken({ id: "admin", email: "admin@example.com", role: "ADMIN" });

    const response = await request(app)
      .post("/api/users/bulk")
      .set("authorization", `Bearer ${token}`)
      .send({ users: [{ name: user.name, email: user.email }] });

    expect(response.status).toBe(201);
    expect(response.body.created).toEqual([{ name: user.name, email: user.email }]);
  });

  it("marks the login session as restricted for an initial-password account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...user,
      passwordHash: await bcrypt.hash("12345678", 4)
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "12345678" });
    const protectedRequest = await request(app)
      .get("/api/rooms")
      .set("authorization", `Bearer ${login.body.token}`);

    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
    expect(protectedRequest.status).toBe(403);
  });

  it("changes the initial password and returns an unrestricted session", async () => {
    const passwordHash = await bcrypt.hash("12345678", 4);
    prismaMock.user.findUnique.mockResolvedValue({ ...user, passwordHash });
    prismaMock.user.update.mockImplementation(async ({ data }) => ({ ...user, ...data }));
    const token = createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: true
    });

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("authorization", `Bearer ${token}`)
      .send({ currentPassword: "12345678", newPassword: "new-secure-password" });

    expect(response.status).toBe(200);
    expect(response.body.user.mustChangePassword).toBe(false);
    expect(response.body.token).toEqual(expect.any(String));
    const update = prismaMock.user.update.mock.calls[0][0];
    expect(update.data.mustChangePassword).toBe(false);
    expect(await bcrypt.compare("new-secure-password", update.data.passwordHash)).toBe(true);
  });

  it("does not change a password when the current password is incorrect", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...user,
      passwordHash: await bcrypt.hash("12345678", 4)
    });
    const token = createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: true
    });

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("authorization", `Bearer ${token}`)
      .send({ currentPassword: "incorrect-password", newPassword: "new-secure-password" });

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("requires the new password to differ from the initial password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...user,
      passwordHash: await bcrypt.hash("12345678", 4)
    });
    const token = createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: true
    });

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("authorization", `Bearer ${token}`)
      .send({ currentPassword: "12345678", newPassword: "12345678" });

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
