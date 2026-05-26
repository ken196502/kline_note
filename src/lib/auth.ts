import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "stock-block-analysis-secret-key-2024"
);

const COOKIE_NAME = "stock_auth_token";

// 预设用户
const USERS: Record<string, { password: string }> = {
  administrator: { password: "lyy@0755" },
  lyy: { password: "trader@0755" },
};

export interface AuthPayload {
  username: string;
  iat: number;
  exp: number;
}

export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const user = USERS[username];
  if (!user || user.password !== password) {
    return { success: false, error: "用户名或密码错误" };
  }

  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d") // 30天过期
    .sign(JWT_SECRET);

  return { success: true, token };
}

export async function verifyToken(
  token: string
): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  return payload?.username ?? null;
}

export { COOKIE_NAME };
