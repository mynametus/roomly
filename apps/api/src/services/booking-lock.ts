import type { Prisma } from "@prisma/client";

export async function acquireBookingLock(transaction: Pick<Prisma.TransactionClient, "$queryRaw">, key: string): Promise<void> {
  // pg_advisory_xact_lock returns void, which Prisma cannot deserialize.
  // Cast only the result; the transaction-scoped lock stays held until commit/rollback.
  await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS "lock"`;
}
