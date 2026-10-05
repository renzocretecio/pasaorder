import bcrypt from "bcrypt";
import { loginSchema, registerSchema } from "@pasaorder/validation";
import {
  createUser,
  findUserByEmail,
  findUserById,
  revokeUserTokens,
} from "./auth.repository.js";
import { signToken } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errors.js";
const dummyPasswordHash = bcrypt.hash(
  "pasaorder-dummy-password-for-timing",
  12,
);

export async function registerUser(input: unknown) {
  const parsed = registerSchema.parse(input);
  if (await findUserByEmail(parsed.email))
    throw new AppError(409, "User already exists");
  const user = await createUser({
    email: parsed.email,
    name: parsed.name,
    passwordHash: await bcrypt.hash(parsed.password, 12),
  });
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    token: signToken(user.id, user.tokenVersion),
  };
}
export async function loginUser(input: unknown) {
  const parsed = loginSchema.parse(input);
  const user = await findUserByEmail(parsed.email);
  const passwordMatches = await bcrypt.compare(
    parsed.password,
    user?.passwordHash ?? (await dummyPasswordHash),
  );
  if (!user || !passwordMatches) throw new AppError(401, "Invalid credentials");
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    token: signToken(user.id, user.tokenVersion),
  };
}
export async function getCurrentUser(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw new AppError(401, "User no longer exists");
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export async function logoutUser(userId: string) {
  await revokeUserTokens(userId);
}
