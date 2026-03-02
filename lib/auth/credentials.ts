// lib/auth/credentials.ts — 사용자 인증 (파일 우선, 환경변수 폴백)
import fs from 'fs';
import path from 'path';
import type { UserRole } from './jwt';

export interface UserRecord {
  email: string;
  passwordHash: string; // bcrypt hash
  role: UserRole;
  name?: string;
}

function loadUsers(): UserRecord[] {
  // 1순위: .local-db/auth-users.json (dotenv-expand $ 이슈 우회)
  const filePath = path.join(process.cwd(), '.local-db', 'auth-users.json');
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as UserRecord[];
    } catch {
      // 파일 읽기 실패 시 env var 폴백
    }
  }

  // 2순위: AUTH_USERS 환경변수
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
