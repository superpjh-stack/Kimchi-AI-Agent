'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { dispatchMascotEvent } from '@/lib/utils/mascot-event';
import { useRouter } from 'next/navigation';

const QUICK_LOGIN = { username: 'admin', password: 'admin1234' };

export default function LoginForm() {
  const t = useTranslations('auth');
  const { login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function doLogin(u: string, p: string) {
    setError('');
    setIsSubmitting(true);
    try {
      await login(u, p);
      dispatchMascotEvent('celebrating', 'auth');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
      dispatchMascotEvent('error', 'auth');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await doLogin(username, password);
  }

  async function handleQuickLogin() {
    setUsername(QUICK_LOGIN.username);
    setPassword(QUICK_LOGIN.password);
    await doLogin(QUICK_LOGIN.username, QUICK_LOGIN.password);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-kimchi-cream px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-kimchi-red/10 rounded-full mb-4">
            <span className="text-3xl">🌶️</span>
          </div>
          <h1 className="text-xl font-bold text-brand-text-primary">{t('appTitle')}</h1>
          <p className="text-sm text-brand-text-secondary mt-1">{t('loginDescription')}</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-kimchi-beige-dark p-6 space-y-4">
          <h2 className="text-lg font-semibold text-brand-text-primary text-center">{t('loginTitle')}</h2>

          {error && (
            <div role="alert" className="text-sm text-kimchi-red bg-kimchi-red/5 border border-kimchi-red/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-brand-text-primary mb-1">
              {t('username')}
            </label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('usernamePlaceholder')}
              className="w-full px-3 py-2.5 rounded-lg border border-kimchi-beige-dark bg-kimchi-cream/50 text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-kimchi-red/30 focus:border-kimchi-red transition-colors text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-brand-text-primary mb-1">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="w-full px-3 py-2.5 rounded-lg border border-kimchi-beige-dark bg-kimchi-cream/50 text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-kimchi-red/30 focus:border-kimchi-red transition-colors text-sm"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg bg-kimchi-red text-white font-medium text-sm hover:bg-kimchi-red-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isSubmitting ? t('loggingIn') : t('login')}
          </button>

          {/* 퀵 로그인 구분선 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-kimchi-beige-dark" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-brand-text-muted">또는</span>
            </div>
          </div>

          {/* 퀵 로그인 버튼 */}
          <button
            type="button"
            onClick={handleQuickLogin}
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg border-2 border-dashed border-kimchi-orange/50 bg-kimchi-orange/5 text-kimchi-orange font-medium text-sm hover:bg-kimchi-orange/10 hover:border-kimchi-orange transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-0.5"
          >
            <span>{t('quickLogin')}</span>
            <span className="text-xs font-normal opacity-70">{t('quickLoginHint')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
