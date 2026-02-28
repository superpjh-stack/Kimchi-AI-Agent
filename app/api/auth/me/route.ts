// app/api/auth/me/route.ts — GET /api/auth/me
import { withAuth, type AuthRequest } from '@/lib/auth/auth-middleware';

export const runtime = 'nodejs';

export const GET = withAuth(async (req: AuthRequest) => {
  const { sub: email, role, name } = req.user;
  return Response.json({ user: { email, role, name: name ?? null } });
});
