// lib/auth/credentials.ts — 사용자 인증 (파일 > 환경변수 > 기본값 순)
import fs from 'fs';
import path from 'path';
import type { UserRole } from './jwt';

export interface UserRecord {
  email: string;
  passwordHash: string; // bcrypt hash
  role: UserRole;
  name?: string;
}

// 기본 관리자 계정 — AUTH_USERS 환경변수 또는 auth-users.json 미설정 시 사용
// 비밀번호: admin1234  (bcrypt hash, 10 rounds)
const DEFAULT_USERS: UserRecord[] = [
  {
    email: 'admin',
    passwordHash: '$2b$10$UsS05wjVKwU0lLbZiMTNhuRhkwp24Kp1hzcxxqT8mFCtMfjFq.66m',
    role: 'admin',
    name: '관리자',
  },
];

function loadUsers(): UserRecord[] {
  // 1순위: .local-db/auth-users.json (로컬 개발용, dotenv-expand $ 이슈 우회)
  try {
    const filePath = path.join(process.cwd(), '.local-db', 'auth-users.json');
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as UserRecord[];
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // 파일 읽기 실패 시 다음 단계로
  }

  // 2순위: AUTH_USERS 환경변수 (Vercel 등 운영계에서 설정)
  const raw = process.env.AUTH_USERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as UserRecord[];
      if (parsed.length > 0) return parsed;
    } catch {
      // JSON 파싱 실패 시 기본값 사용
    }
  }

  // 3순위: 기본 관리자 계정 (admin / admin1234)
  return DEFAULT_USERS;
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
    return null;
  }
}
