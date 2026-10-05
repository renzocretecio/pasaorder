export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};
export type AuthResponse = { user: AuthUser; token: string };
