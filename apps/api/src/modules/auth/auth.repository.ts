import { pool, queryOne as executeOne } from "../../db.js";
import type { PoolClient } from "pg";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  googleSub: string | null;
  tokenVersion: number;
  createdAt: string;
};

type DbUserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  googleSub: string | null;
  tokenVersion: number;
  createdAt: Date;
};

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const row = await executeOne<DbUserRow>(
    `SELECT id, email, name, password_hash AS "passwordHash", google_sub AS "googleSub", token_version AS "tokenVersion", created_at AS "createdAt"
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );

  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<AuthUser> {
  const row = await executeOne<DbUserRow>(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, password_hash AS "passwordHash", google_sub AS "googleSub", token_version AS "tokenVersion", created_at AS "createdAt"`,
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
    googleSub: row.googleSub,
    tokenVersion: row.tokenVersion,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const row = await executeOne<DbUserRow>(
    `SELECT id, email, name, password_hash AS "passwordHash", google_sub AS "googleSub", token_version AS "tokenVersion", created_at AS "createdAt" FROM users WHERE id = $1`,
    [id],
  );
  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export type GoogleOAuthState = {
  nonce: string;
  codeVerifier: string;
};

export async function saveGoogleOAuthState(
  stateHash: string,
  nonce: string,
  codeVerifier: string,
) {
  await executeOne("DELETE FROM google_oauth_states WHERE expires_at <= now()");
  await executeOne(
    `INSERT INTO google_oauth_states (state_hash, nonce, code_verifier, expires_at)
     VALUES ($1, $2, $3, now() + interval '10 minutes')`,
    [stateHash, nonce, codeVerifier],
  );
}

export async function consumeGoogleOAuthState(
  stateHash: string,
): Promise<GoogleOAuthState | null> {
  return executeOne<GoogleOAuthState>(
    `DELETE FROM google_oauth_states
     WHERE state_hash = $1 AND expires_at > now()
     RETURNING nonce, code_verifier AS "codeVerifier"`,
    [stateHash],
  );
}

export async function createGoogleOAuthCode(codeHash: string, userId: string) {
  await executeOne("DELETE FROM google_oauth_codes WHERE expires_at <= now()");
  await executeOne(
    `INSERT INTO google_oauth_codes (code_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '60 seconds')`,
    [codeHash, userId],
  );
}

export async function consumeGoogleOAuthCode(codeHash: string) {
  const result = await executeOne<{ userId: string }>(
    `DELETE FROM google_oauth_codes
     WHERE code_hash = $1 AND expires_at > now()
     RETURNING user_id AS "userId"`,
    [codeHash],
  );
  return result ? findUserById(result.userId) : null;
}

type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  hostedDomain?: string;
};

export async function findOrCreateGoogleUser(identity: GoogleIdentity) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const linked = await findUserByGoogleSub(client, identity.sub);
    if (linked) {
      await client.query("COMMIT");
      return linked;
    }

    const existing = await findUserByEmailWithClient(client, identity.email);
    if (existing) {
      if (existing.googleSub && existing.googleSub !== identity.sub)
        throw new Error("Google account conflict");
      const emailDomain = identity.email.split("@")[1];
      const googleOwnsEmail =
        emailDomain === "gmail.com" ||
        (identity.hostedDomain && emailDomain === identity.hostedDomain);
      if (!existing.googleSub && !googleOwnsEmail)
        throw new Error("Google email cannot be safely linked");
      const linkedAccount = await client.query<DbUserRow>(
        `UPDATE users SET google_sub = $1
         WHERE id = $2 AND google_sub IS NULL
         RETURNING id, email, name, password_hash AS "passwordHash", google_sub AS "googleSub", token_version AS "tokenVersion", created_at AS "createdAt"`,
        [identity.sub, existing.id],
      );
      const user = linkedAccount.rows[0] ?? existing;
      if (user.googleSub !== identity.sub)
        throw new Error("Google account conflict");
      await client.query("COMMIT");
      return mapUser(user);
    }

    const created = await client.query<DbUserRow>(
      `INSERT INTO users (email, name, password_hash, google_sub)
       VALUES ($1, $2, NULL, $3)
       RETURNING id, email, name, password_hash AS "passwordHash", google_sub AS "googleSub", token_version AS "tokenVersion", created_at AS "createdAt"`,
      [identity.email, identity.name, identity.sub],
    );
    await client.query("COMMIT");
    return mapUser(created.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findUserByGoogleSub(client: PoolClient, googleSub: string) {
  const result = await client.query<DbUserRow>(
    `SELECT id, email, name, password_hash AS "passwordHash", google_sub AS "googleSub", token_version AS "tokenVersion", created_at AS "createdAt"
     FROM users WHERE google_sub = $1 FOR UPDATE`,
    [googleSub],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

async function findUserByEmailWithClient(client: PoolClient, email: string) {
  const result = await client.query<DbUserRow>(
    `SELECT id, email, name, password_hash AS "passwordHash", google_sub AS "googleSub", token_version AS "tokenVersion", created_at AS "createdAt"
     FROM users WHERE email = $1 FOR UPDATE`,
    [email],
  );
  return result.rows[0] ?? null;
}

function mapUser(row: DbUserRow): AuthUser {
  return {
    id: String(row.id),
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    googleSub: row.googleSub,
    tokenVersion: row.tokenVersion,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function revokeUserTokens(id: string) {
  await executeOne(
    `UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING id`,
    [id],
  );
}
