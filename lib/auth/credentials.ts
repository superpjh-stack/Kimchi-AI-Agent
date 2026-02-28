// lib/auth/credentials.ts — 환경변수 기반 사용자 인증
import type { UserRole } from './jwt';

export interface UserRecord {
  email: string;
  passwordHash: string; // bcrypt hash
  role: UserRole;
  name?: string;
}

function loadUsers(): UserRecord[] {
  const raw = process.env.AUTH_USERS;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as UserRecord[];
  } catch {
    return [];
  }
}

export async function validateCredentials(
  email: string,
  password: string
): Promise<UserRecord | null> {
  const users = loadUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;

  // bcryptjs는 Edge Runtime 미지원 → 서버 환경에서 동적 import
  try {
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  } catch {
    // bcryptjs 미설치 시 평문 비교 (개발 전용, 프로덕션에서는 bcryptjs 필수)
    if (process.env.NODE_ENV !== 'production') {
      return user.passwordHash === password ? user : null;
    }
    return null;
  }
}
