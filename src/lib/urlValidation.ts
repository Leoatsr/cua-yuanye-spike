/**
 * Submission URL validation.
 *
 * spike-stage rules:
 * - must start with https://
 * - reject obvious placeholders (localhost, 127.0.0.1, example.com/.org/.test)
 * - reject empty / whitespace-only
 * - reject too short (< 12 chars)
 *
 * NOT validated (intentionally permissive):
 * - whether the URL is actually reachable
 * - whether it's actually a Feishu / GitHub / blog URL
 * - HTTP (only HTTPS) — blogs / dev hosts mostly support https
 */

const PLACEHOLDER_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'example.com',
  'example.org',
  'example.test',
  'feishu.example',         // even though our virtual submissions use this, real ones shouldn't
  'github.example',
  'placeholder.com',
  'test.com',
];

export interface UrlValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateSubmissionUrl(raw: string): UrlValidationResult {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { ok: false, reason: '请填写链接' };
  }
  if (trimmed.length < 12) {
    return { ok: false, reason: '链接太短，似乎不完整' };
  }
  if (!trimmed.startsWith('https://')) {
    return { ok: false, reason: '必须以 https:// 开头（http 不接受）' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: '链接格式不正确' };
  }

  const host = parsed.hostname.toLowerCase();
  if (PLACEHOLDER_HOSTS.some((p) => host === p || host.endsWith('.' + p))) {
    return { ok: false, reason: '占位链接不能用于真实提交' };
  }

  // Reject pure-IP hosts (mostly used as test hosts)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return { ok: false, reason: '不接受 IP 地址' };
  }

  return { ok: true };
}
