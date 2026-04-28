/**
 * Sentry initialization — A7 standard edition.
 *
 * Why this exists:
 * - Catches uncaught JS errors automatically
 * - Captures React render errors via ErrorBoundary
 * - Tags errors with GitHub username (after login)
 * - Captures cloud write failures (mail / cv / quest / review)
 *
 * Configuration:
 * - VITE_SENTRY_DSN must be set in .env.local + Vercel env vars
 * - If not set, Sentry is disabled (no crash)
 * - Dev mode (pnpm dev) does NOT send to Sentry — only prod
 */

import * as Sentry from '@sentry/react';

const env = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};
const dsn = env.VITE_SENTRY_DSN as string | undefined;
const isProd = env.PROD === true || env.MODE === 'production';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;

  if (!dsn) {
    if (isProd) {
      // eslint-disable-next-line no-console
      console.warn('[sentry] VITE_SENTRY_DSN not set. Errors not reported.');
    }
    return;
  }

  if (!isProd) {
    // eslint-disable-next-line no-console
    console.log('[sentry] dev mode — errors NOT sent to Sentry');
    return;
  }

  Sentry.init({
    dsn,
    release: (env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined) ?? 'unknown',
    environment: 'production',
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    beforeSend(event, hint) {
      const error = hint.originalException;
      if (error instanceof Error) {
        if (error.message?.includes('extension://')) return null;
        if (error.message?.includes('ResizeObserver loop')) return null;
      }
      return event;
    },
  });
}

export function setSentryUser(user: { id: string; githubUsername: string } | null): void {
  if (!initialized || !dsn || !isProd) return;
  if (user) {
    Sentry.setUser({ id: user.id, username: user.githubUsername });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Manually report a non-fatal error with context.
 * Use this for cloud write failures, validation errors, etc.
 *
 * J2-B: 同时写到 Supabase client_errors 表（用于看板）
 */
export function reportError(
  label: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  // eslint-disable-next-line no-console
  console.warn(`[error] ${label}:`, error, context ?? '');

  // J2-B: 写到 Supabase client_errors（异步，不 block）
  // Lazy import 避免循环依赖
  void import('./errorReporter').then(({ recordError }) => {
    recordError(label, error, context);
  }).catch(() => {
    // ignore - errorReporter import 失败不影响主流程
  });

  if (!initialized || !dsn || !isProd) return;

  Sentry.withScope((scope) => {
    scope.setTag('error_label', label);
    if (context) {
      Object.entries(context).forEach(([k, v]) => {
        scope.setExtra(k, v);
      });
    }
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(`${label}: ${String(error)}`, 'warning');
    }
  });
}

/** Track a non-error event. Use sparingly. */
export function trackEvent(name: string, data?: Record<string, unknown>): void {
  if (!initialized || !dsn || !isProd) return;
  Sentry.addBreadcrumb({
    category: 'app',
    message: name,
    level: 'info',
    data,
  });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
