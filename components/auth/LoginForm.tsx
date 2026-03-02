'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { dispatchMascotEvent } from '@/lib/utils/mascot-event';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const t = useTranslations('auth');
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      dispatchMascotEvent('celebrating', 'auth');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
      dispatchMascotEvent('error', 'auth');
    } finally {
      setIsSubmitting(false);
    }
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
            <label htmlFor="email" className="block text-sm font-medium text-brand-text-primary mb-1">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
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
        </form>
      </div>
    </div>
  );
}
