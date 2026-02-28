// e2e/auth.spec.ts — 인증 플로우 E2E 테스트
import { test, expect } from '@playwright/test';

test.describe('Auth Flow (TC-E2E-01~03)', () => {
  test('TC-E2E-01: 로그인 페이지 접근 가능', async ({ page }) => {
    // DEV_AUTH_BYPASS가 활성화된 개발 환경에서는 메인 페이지로 리다이렉트
    // CI에서는 /api/auth/login 엔드포인트 존재 확인
    const res = await page.request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'invalid' },
    });
    // 400 (잘못된 자격증명) 또는 401이면 엔드포인트가 살아있는 것
    expect([400, 401, 422]).toContain(res.status());
  });

  test('TC-E2E-02: 잘못된 자격증명으로 로그인 실패 응답', async ({ page }) => {
    const res = await page.request.post('/api/auth/login', {
      data: { email: 'nobody@invalid.com', password: 'wrongpassword' },
    });
    // 401 또는 400 (자격증명 거부)
    expect([400, 401]).toContain(res.status());
  });

  test('TC-E2E-03: 로그아웃 엔드포인트 응답', async ({ page }) => {
    const res = await page.request.post('/api/auth/logout');
    // 로그아웃은 항상 200
    expect(res.status()).toBe(200);
  });
});
