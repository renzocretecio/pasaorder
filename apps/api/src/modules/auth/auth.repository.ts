import { queryOne as executeOne } from "../../db.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  tokenVersion: number;
  createdAt: string;
};

type DbUserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  tokenVersion: number;
  createdAt: Date;
};

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const row = await executeOne<DbUserRow>(
    `SELECT id, email, name, password_hash AS "passwordHash", token_version AS "tokenVersion", created_at AS "createdAt"
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );

  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export async function createUser(
  input: Omit<AuthUser, "id" | "createdAt" | "tokenVersion">,
): Promise<AuthUser> {
  const row = await executeOne<DbUserRow>(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, password_hash AS "passwordHash", token_version AS "tokenVersion", created_at AS "createdAt"`,
    [input.email, input.passwordHash, input.name],
  );

  if (!row) {
    throw new Error("Failed to create user");
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    tokenVersion: row.tokenVersion,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const row = await executeOne<DbUserRow>(
    `SELECT id, email, name, password_hash AS "passwordHash", token_version AS "tokenVersion", created_at AS "createdAt" FROM users WHERE id = $1`,
    [id],
  );
  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export async function revokeUserTokens(id: string) {
  await executeOne(
    `UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING id`,
    [id],
  );
}
