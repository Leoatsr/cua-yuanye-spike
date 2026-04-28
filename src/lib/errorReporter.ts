import { getSupabase } from './supabase';

/**
 * J2-B · 客户端错误埋点
 *
 * - 写到 Supabase client_errors 表
 * - sentry.ts 的 reportError 也会调这里
 * - throttle 同 context + message 5 分钟内只写 1 次
 * - 全局 window.error 也会被捕获
 */

interface ErrorRecord {
  context: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
const lastSentMap = new Map<string, number>();
const queue: ErrorRecord[] = [];
let flushTimer: number | null = null;
let started = false;

/** 记录一个错误（throttled）*/
export function recordError(
  context: string,
  err: unknown,
  metadata?: Record<string, unknown>
): void {
  let message: string;
  let stack: string | undefined;

  if (err instanceof Error) {
    message = err.message || String(err);
    stack = err.stack;
  } else if (typeof err === 'string') {
    message = err;
  } else if (err && typeof err === 'object') {
    try {
      message = JSON.stringify(err).slice(0, 500);
    } catch {
      message = String(err);
    }
  } else {
    message = String(err);
  }

  // Throttle
  const key = `${context}::${message.slice(0, 100)}`;
  const now = Date.now();
  const lastSent = lastSentMap.get(key);
  if (lastSent && now - lastSent < THROTTLE_MS) return;
  lastSentMap.set(key, now);

  queue.push({
    context,
    message: message.slice(0, 1000),
    stack: stack?.slice(0, 4000),
    metadata,
  });

  // 批量延迟 flush
  if (flushTimer === null && typeof window !== 'undefined') {
    flushTimer = window.setTimeout(() => {
      void flushQueue();
    }, 2000);
  }
}

async function flushQueue(): Promise<void> {
  flushTimer = null;
  if (queue.length === 0) return;
  const supabase = getSupabase();
  if (!supabase) return;

  const batch = queue.splice(0, queue.length);
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;

    const rows = batch.map((r) => ({
      user_id: userId,
      context: r.context,
      message: r.message,
      stack: r.stack ?? null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      metadata: r.metadata ?? null,
    }));

    await supabase.from('client_errors').insert(rows);
  } catch {
    // 错误埋点失败本身不上报，避免无限循环
  }
}

/** 启动全局 window.error 捕获 */
export function startErrorReporter(): void {
  if (started) return;
  if (typeof window === 'undefined') return;
  started = true;

  window.addEventListener('error', (e) => {
    recordError('window-error', e.error ?? e.message, {
      filename: e.filename,
      lineno: e.lineno,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    recordError('unhandled-rejection', e.reason, {});
  });

  // Flush on page hide
  window.addEventListener('beforeunload', () => {
    if (queue.length > 0) {
      void flushQueue();
    }
  });
}

if (typeof window !== 'undefined') {
  (window as unknown as { __errors: typeof recordError }).__errors = recordError;
}
