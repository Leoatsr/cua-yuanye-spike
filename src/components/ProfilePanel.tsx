import { useEffect, useState, useMemo } from 'react';
import { EventBus } from '../game/EventBus';
import {
  fetchMyProfile,
  updateMyProfile,
  checkUsernameAvailable,
  changeUsername,
  getUsernameChangeStatus,
  WORKSHOP_OPTIONS,
  PROFILE_LIMITS,
  type UserProfile,
  type ProfileLink,
  type UsernameChangeStatus,
} from '../lib/profileStore';
import { useDebounce } from '../lib/useDebounce';

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

/**
 * F4.1 · P 键资料卡
 *
 * Triggered by 'open-profile-panel' event (P key listener emits it).
 * Shows + edits all profile fields. ESC closes.
 *
 * Features:
 *   - Username with realtime availability check (500ms debounce)
 *   - Display name + bio (with char counter)
 *   - Avatar URL preview
 *   - Workshops chips (9 multi-select)
 *   - Links repeater (max 3, name+url pairs)
 *   - Skills + Interests tag input (Enter adds, × removes)
 *   - Location single-line
 *   - Visibility toggle
 */
export function ProfilePanel() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Username availability state
  const [usernameStatus, setUsernameStatus] = useState<
    'unchanged' | 'invalid' | 'checking' | 'available' | 'taken'
  >('unchanged');
  const [cooldownStatus, setCooldownStatus] = useState<UsernameChangeStatus | null>(null);
  const debouncedUsername = useDebounce(draft?.username ?? '', 500);

  useEffect(() => {
    const onOpen = async () => {
      setOpen(true);
      setStatus('loading');
      setErrorMsg('');
      const data = await fetchMyProfile();
      if (data) {
        setProfile(data);
        setDraft({ ...data });
        setStatus('idle');
        setUsernameStatus('unchanged');
        // F4.3c: load cooldown status
        const cd = await getUsernameChangeStatus();
        setCooldownStatus(cd);
      } else {
        setStatus('error');
        setErrorMsg('未能读取资料 · 请确认已登录并跑过 SQL 011');
      }
    };
    EventBus.on('open-profile-panel', onOpen);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'saving') setOpen(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      EventBus.off('open-profile-panel', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [status]);

  // Username availability check (debounced)
  useEffect(() => {
    if (!draft || !profile) {
      setUsernameStatus('unchanged');
      return;
    }
    const trimmed = debouncedUsername.trim();
    if (trimmed === profile.username) {
      setUsernameStatus('unchanged');
      return;
    }
    if (!PROFILE_LIMITS.USERNAME_PATTERN.test(trimmed)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    let cancelled = false;
    void (async () => {
      const available = await checkUsernameAvailable(trimmed);
      if (cancelled) return;
      setUsernameStatus(available ? 'available' : 'taken');
    })();
    return () => { cancelled = true; };
  }, [debouncedUsername, profile, draft]);

  const isDirty = useMemo(() => {
    if (!profile || !draft) return false;
    return JSON.stringify(profile) !== JSON.stringify(draft);
  }, [profile, draft]);

  const canSave = useMemo(() => {
    if (!isDirty || !draft) return false;
    if (status === 'saving') return false;
    // username invalid or taken → can't save
    if (usernameStatus === 'invalid' || usernameStatus === 'taken' || usernameStatus === 'checking') return false;
    // basic validation
    if (draft.display_name.trim().length === 0) return false;
    if (draft.display_name.length > PROFILE_LIMITS.DISPLAY_NAME_MAX) return false;
    if (draft.bio.length > PROFILE_LIMITS.BIO_MAX) return false;
    if (draft.location.length > PROFILE_LIMITS.LOCATION_MAX) return false;
    return true;
  }, [draft, status, usernameStatus, isDirty]);

  if (!open) return null;

  const handleSave = async () => {
    if (!draft || !profile || !canSave) return;
    setStatus('saving');
    setErrorMsg('');

    const usernameChanged = draft.username.trim().toLowerCase() !== profile.username.toLowerCase();

    // F4.3c: if username changed, call change_username RPC first (cooldown + history check)
    if (usernameChanged) {
      const usernameResult = await changeUsername(draft.username.trim());
      if (!usernameResult.ok) {
        setStatus('error');
        setErrorMsg(usernameResult.error ?? '修改 username 失败');
        return;
      }
      // Refresh cooldown status
      const cd = await getUsernameChangeStatus();
      setCooldownStatus(cd);
    }

    // Update other fields (username will be stripped by updateMyProfile)
    const patch: Partial<UserProfile> = {
      display_name: draft.display_name.trim(),
      bio: draft.bio,
      avatar_url: draft.avatar_url,
      workshops: draft.workshops,
      links: draft.links,
      skills: draft.skills,
      location: draft.location.trim(),
      interests: draft.interests,
      visibility: draft.visibility,
    };
    const result = await updateMyProfile(patch);
    if (result.ok && result.profile) {
      setProfile(result.profile);
      setDraft({ ...result.profile });
      setStatus('saved');
      setUsernameStatus('unchanged');
      EventBus.emit('show-toast', {
        text: usernameChanged ? '✦ 资料已保存 · username 已更新' : '✦ 资料已保存',
      });
      setTimeout(() => setStatus('idle'), 1500);
    } else {
      setStatus('error');
      setErrorMsg(result.error ?? '保存失败');
    }
  };

  // ---------- mutators ----------
  const update = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => {
    if (!draft) return;
    setDraft({ ...draft, [k]: v });
  };
  const toggleWorkshop = (w: string) => {
    if (!draft) return;
    const has = draft.workshops.includes(w);
    update('workshops', has
      ? draft.workshops.filter((x) => x !== w)
      : [...draft.workshops, w]);
  };
  const addLink = () => {
    if (!draft) return;
    if (draft.links.length >= PROFILE_LIMITS.LINKS_MAX) return;
    update('links', [...draft.links, { name: '', url: '' }]);
  };
  const updateLink = (i: number, field: keyof ProfileLink, v: string) => {
    if (!draft) return;
    const next = [...draft.links];
    next[i] = { ...next[i], [field]: v };
    update('links', next);
  };
  const removeLink = (i: number) => {
    if (!draft) return;
    update('links', draft.links.filter((_, idx) => idx !== i));
  };

  return (
    <div
      onClick={() => { if (status !== 'saving') setOpen(false); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(8, 12, 18, 0.92)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '40px 24px',
        backdropFilter: 'blur(3px)',
        animation: 'profileFadeIn 0.3s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 720, width: '100%',
          background: 'linear-gradient(180deg, #1f2230 0%, #15171f 100%)',
          border: '1px solid rgba(184, 137, 58, 0.4)',
          borderRadius: 6,
          padding: '32px 36px 28px',
          boxShadow: '0 12px 50px rgba(0,0,0,0.7)',
          color: '#f5f0e0',
        }}
      >
        {/* Header */}
        <div style={{
          borderBottom: '1px solid rgba(184, 137, 58, 0.25)',
          paddingBottom: 16, marginBottom: 20,
        }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.25em',
            color: '#b8893a', textTransform: 'uppercase', marginBottom: 6,
          }}>
            PROFILE · 我 的 资 料
          </div>
          <div style={{
            fontFamily: 'serif', fontSize: 22, fontWeight: 600,
            color: '#f5f0e0', letterSpacing: '0.05em',
          }}>
            ✦ 玩 家 资 料 ✦
          </div>
          <div style={{ fontSize: 12, color: '#a8a08e', marginTop: 6 }}>
            按 Esc 关闭 · 修改后点保存生效
          </div>
        </div>

        {status === 'loading' && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#8a8576' }}>
            读取中...
          </div>
        )}

        {status === 'error' && !draft && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#e0a090' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {draft && (
          <>
            {/* Avatar + identity */}
            <Section title="基本">
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: '#2a2e36',
                  border: '2px solid rgba(184, 137, 58, 0.4)',
                  flexShrink: 0,
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {draft.avatar_url ? (
                    <img
                      src={draft.avatar_url}
                      alt="头像"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span style={{ color: '#6e6856', fontSize: 22 }}>?</span>
                  )}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Field label="头像 URL">
                    <Input
                      value={draft.avatar_url ?? ''}
                      onChange={(v) => update('avatar_url', v || null)}
                      placeholder="https://..."
                    />
                  </Field>
                  <Field label="昵称（display name）">
                    <Input
                      value={draft.display_name}
                      onChange={(v) => update('display_name', v)}
                      maxLength={PROFILE_LIMITS.DISPLAY_NAME_MAX}
                    />
                  </Field>
                </div>
              </div>
            </Section>

            {/* Username */}
            <Section title="用户名">
              <Field
                label="username（用于公开页 /u/[username]）"
                hint="2-30 字 · 仅 a-zA-Z0-9_- · 修改 30 天 cooldown · 旧 URL 自动重定向 90 天"
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={draft.username}
                    onChange={(e) => update('username', e.target.value)}
                    maxLength={PROFILE_LIMITS.USERNAME_MAX}
                    disabled={cooldownStatus !== null && !cooldownStatus.can_change}
                    style={{
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      background: 'rgba(168, 179, 160, 0.05)',
                      border: '1px solid rgba(168, 179, 160, 0.25)',
                      borderRadius: 3,
                      color: '#f5f0e0', fontSize: 13,
                      fontFamily: 'inherit', outline: 'none',
                      width: '100%',
                      opacity: cooldownStatus && !cooldownStatus.can_change ? 0.5 : 1,
                      cursor: cooldownStatus && !cooldownStatus.can_change ? 'not-allowed' : 'text',
                    }}
                  />
                  <UsernameStatus status={usernameStatus} />
                </div>
                {cooldownStatus && !cooldownStatus.can_change && (
                  <div style={{
                    marginTop: 6,
                    padding: '6px 10px',
                    background: 'rgba(168, 179, 160, 0.06)',
                    border: '1px solid rgba(168, 179, 160, 0.18)',
                    borderRadius: 3,
                    fontSize: 11, color: '#a8a08e',
                  }}>
                    🔒 距下次可改 username 还有 <strong style={{ color: '#e0b060' }}>{cooldownStatus.days_remaining}</strong> 天
                    {cooldownStatus.next_change_after && (
                      <span style={{ color: '#6e6856', fontFamily: 'monospace', marginLeft: 6 }}>
                        （{new Date(cooldownStatus.next_change_after).toLocaleDateString('zh-CN')}）
                      </span>
                    )}
                  </div>
                )}
              </Field>
            </Section>

            {/* Bio */}
            <Section title="简介">
              <Field
                label={`bio (${draft.bio.length}/${PROFILE_LIMITS.BIO_MAX})`}
              >
                <textarea
                  value={draft.bio}
                  onChange={(e) => update('bio', e.target.value)}
                  maxLength={PROFILE_LIMITS.BIO_MAX}
                  rows={3}
                  placeholder="一句话介绍自己..."
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 10px',
                    background: 'rgba(168, 179, 160, 0.05)',
                    border: '1px solid rgba(168, 179, 160, 0.25)',
                    borderRadius: 3,
                    color: '#f5f0e0', fontSize: 13,
                    fontFamily: 'inherit', resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </Field>
            </Section>

            {/* Workshops */}
            <Section title="所属工作组（多选）">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {WORKSHOP_OPTIONS.map((w) => {
                  const selected = draft.workshops.includes(w);
                  return (
                    <button
                      key={w}
                      onClick={() => toggleWorkshop(w)}
                      style={{
                        padding: '6px 12px', fontSize: 12,
                        background: selected ? 'rgba(184, 137, 58, 0.25)' : 'rgba(168, 179, 160, 0.05)',
                        color: selected ? '#e0b060' : '#a8a08e',
                        border: `1px solid ${selected ? 'rgba(184, 137, 58, 0.7)' : 'rgba(168, 179, 160, 0.25)'}`,
                        borderRadius: 3, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {selected ? '✓ ' : ''}{w}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Links */}
            <Section title={`个人链接（${draft.links.length}/${PROFILE_LIMITS.LINKS_MAX}）`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draft.links.map((link, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6 }}>
                    <Input
                      value={link.name}
                      onChange={(v) => updateLink(i, 'name', v)}
                      placeholder="名称（如 GitHub）"
                      style={{ width: 120 }}
                    />
                    <Input
                      value={link.url}
                      onChange={(v) => updateLink(i, 'url', v)}
                      placeholder="https://..."
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={() => removeLink(i)}
                      style={{
                        padding: '6px 10px', fontSize: 12,
                        background: 'transparent', color: '#8a8576',
                        border: '1px solid rgba(168, 179, 160, 0.25)',
                        borderRadius: 3, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {draft.links.length < PROFILE_LIMITS.LINKS_MAX && (
                  <button
                    onClick={addLink}
                    style={{
                      padding: '6px 14px', fontSize: 12,
                      background: 'rgba(184, 137, 58, 0.08)', color: '#b8893a',
                      border: '1px dashed rgba(184, 137, 58, 0.4)',
                      borderRadius: 3, cursor: 'pointer',
                      fontFamily: 'inherit', alignSelf: 'flex-start',
                    }}
                  >
                    + 添加链接
                  </button>
                )}
              </div>
            </Section>

            {/* Skills */}
            <Section title={`技能（${draft.skills.length}/${PROFILE_LIMITS.SKILLS_MAX}）`}>
              <TagInput
                tags={draft.skills}
                max={PROFILE_LIMITS.SKILLS_MAX}
                onChange={(tags) => update('skills', tags)}
                placeholder="输入技能，回车添加（如：Python / 写作 / 测评）"
              />
            </Section>

            {/* Interests */}
            <Section title={`兴趣（${draft.interests.length}/${PROFILE_LIMITS.INTERESTS_MAX}）`}>
              <TagInput
                tags={draft.interests}
                max={PROFILE_LIMITS.INTERESTS_MAX}
                onChange={(tags) => update('interests', tags)}
                placeholder="输入兴趣，回车添加（如：开源 / 摄影）"
              />
            </Section>

            {/* Location */}
            <Section title="位置">
              <Field label="city（仅城市，可选）">
                <Input
                  value={draft.location}
                  onChange={(v) => update('location', v)}
                  maxLength={PROFILE_LIMITS.LOCATION_MAX}
                  placeholder="北京 / Shanghai / Berlin..."
                />
              </Field>
            </Section>

            {/* Visibility */}
            <Section title="可见性">
              <div style={{ display: 'flex', gap: 8 }}>
                {(['public', 'private'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => update('visibility', v)}
                    style={{
                      flex: 1, padding: '8px 14px', fontSize: 12,
                      background: draft.visibility === v
                        ? 'rgba(127, 192, 144, 0.2)'
                        : 'rgba(168, 179, 160, 0.05)',
                      color: draft.visibility === v ? '#7fc090' : '#a8a08e',
                      border: `1px solid ${draft.visibility === v ? 'rgba(127, 192, 144, 0.6)' : 'rgba(168, 179, 160, 0.25)'}`,
                      borderRadius: 3, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {v === 'public' ? '公开 · 任何 CUA 成员可看' : '私密 · 仅自己'}
                  </button>
                ))}
              </div>
            </Section>

            {/* Footer */}
            <div style={{
              marginTop: 24, paddingTop: 16,
              borderTop: '1px solid rgba(184, 137, 58, 0.15)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {status === 'error' && (
                <span style={{ flex: 1, fontSize: 12, color: '#e0a090' }}>
                  ⚠️ {errorMsg}
                </span>
              )}
              {status === 'saved' && (
                <span style={{ flex: 1, fontSize: 12, color: '#7fc090' }}>
                  ✓ 已保存
                </span>
              )}
              {status === 'idle' && isDirty && (
                <span style={{ flex: 1, fontSize: 12, color: '#b8893a' }}>
                  · 有未保存的修改
                </span>
              )}
              {status === 'idle' && !isDirty && (
                <span style={{ flex: 1, fontSize: 11, color: '#6e6856' }}>
                  加入：{new Date(draft.joined_at).toLocaleDateString('zh-CN')}
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                disabled={status === 'saving'}
                style={{
                  padding: '8px 18px', fontSize: 13,
                  background: 'transparent', color: '#a8a08e',
                  border: '1px solid rgba(168, 179, 160, 0.3)',
                  borderRadius: 3,
                  cursor: status === 'saving' ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                关闭
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                style={{
                  padding: '8px 22px', fontSize: 13, fontWeight: 600,
                  background: canSave ? 'rgba(184, 137, 58, 0.2)' : 'rgba(168, 179, 160, 0.05)',
                  color: canSave ? '#e0b060' : '#6e6856',
                  border: `1px solid ${canSave ? 'rgba(184, 137, 58, 0.6)' : 'rgba(168, 179, 160, 0.15)'}`,
                  borderRadius: 3,
                  cursor: canSave ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  letterSpacing: '0.08em',
                }}
              >
                {status === 'saving' ? '保存中...' : '✦ 保存'}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes profileFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ===== Sub-components =====

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.15em',
        color: '#b8893a', marginBottom: 8,
        fontFamily: 'monospace',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11, color: '#a8a08e', marginBottom: 4,
      }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 10, color: '#6e6856', marginTop: 3 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Input({
  value, onChange, placeholder, maxLength, style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{
        boxSizing: 'border-box',
        padding: '8px 10px',
        background: 'rgba(168, 179, 160, 0.05)',
        border: '1px solid rgba(168, 179, 160, 0.25)',
        borderRadius: 3,
        color: '#f5f0e0', fontSize: 13,
        fontFamily: 'inherit', outline: 'none',
        width: '100%',
        ...style,
      }}
    />
  );
}

function UsernameStatus({ status }: { status: string }) {
  const map: Record<string, { text: string; color: string }> = {
    unchanged: { text: '', color: '' },
    invalid: { text: '× 格式不合法', color: '#e0a090' },
    checking: { text: '... 检查中', color: '#a8a08e' },
    available: { text: '✓ 可用', color: '#7fc090' },
    taken: { text: '× 已被占用', color: '#e0a090' },
  };
  const m = map[status];
  if (!m || !m.text) return null;
  return (
    <span style={{
      fontSize: 11, color: m.color,
      whiteSpace: 'nowrap',
      minWidth: 80,
    }}>
      {m.text}
    </span>
  );
}

function TagInput({
  tags, max, onChange, placeholder,
}: {
  tags: string[];
  max: number;
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');
  const addTag = () => {
    const v = input.trim();
    if (!v) return;
    if (tags.length >= max) return;
    if (tags.includes(v)) return;
    onChange([...tags, v]);
    setInput('');
  };
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {tags.map((t, i) => (
          <span
            key={i}
            style={{
              padding: '3px 8px',
              background: 'rgba(96, 165, 250, 0.15)',
              border: '1px solid rgba(96, 165, 250, 0.4)',
              borderRadius: 11, fontSize: 11,
              color: '#a5c8ff',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {t}
            <button
              onClick={() => onChange(tags.filter((_, idx) => idx !== i))}
              style={{
                background: 'transparent', border: 'none',
                color: '#a5c8ff', cursor: 'pointer',
                fontSize: 12, padding: 0, lineHeight: 1,
              }}
              aria-label="删除"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {tags.length < max && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          placeholder={placeholder}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '8px 10px',
            background: 'rgba(168, 179, 160, 0.05)',
            border: '1px solid rgba(168, 179, 160, 0.25)',
            borderRadius: 3,
            color: '#f5f0e0', fontSize: 12,
            fontFamily: 'inherit', outline: 'none',
          }}
        />
      )}
    </div>
  );
}
