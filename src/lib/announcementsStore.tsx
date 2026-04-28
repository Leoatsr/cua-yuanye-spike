/**
 * 公告板 store
 *
 * - fetch /announcements.md (Vite 把 public/ 直接放在根)
 * - 简易 Markdown → React.ReactNode 解析（不引入 react-markdown 依赖）
 * - 5 分钟缓存
 */

import type { ReactNode } from 'react';

let cached: { content: string; at: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchAnnouncements(): Promise<string> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.content;
  }
  try {
    const res = await fetch('/announcements.md', { cache: 'no-cache' });
    if (!res.ok) return '# 公告\n\n（加载失败）';
    const text = await res.text();
    cached = { content: text, at: Date.now() };
    return text;
  } catch {
    return '# 公告\n\n（加载失败）';
  }
}

export function invalidateAnnouncementsCache(): void {
  cached = null;
}

/**
 * 简易 Markdown 解析 → React 节点
 *
 * 支持：
 *   - # / ## / ### 标题
 *   - --- 分隔线
 *   - *italic* / **bold**
 *   - - / * 无序列表
 *   - - [ ] / - [x] 任务列表
 *   - `inline code`
 *   - [text](url) 链接
 *
 * 不支持：
 *   - 代码块 (```)
 *   - 嵌套列表
 *   - 表格
 *   - 图片
 *
 * 已知够用，不需要完整 markdown。
 */
export function renderMarkdown(md: string): ReactNode[] {
  const lines = md.split('\n');
  const nodes: ReactNode[] = [];
  let key = 0;
  let listBuffer: { items: ReactNode[]; tasks: boolean[] | null } | null = null;

  const flushList = () => {
    if (listBuffer) {
      nodes.push(
        <ul
          key={`l-${key++}`}
          style={{
            margin: '4px 0 12px',
            paddingLeft: 22,
            listStyleType: listBuffer.tasks ? 'none' : 'disc',
            color: '#d8cfa8',
          }}
        >
          {listBuffer.items.map((it, i) => {
            const isTask = listBuffer!.tasks?.[i];
            const checked = listBuffer!.tasks?.[i] === true;
            return (
              <li
                key={i}
                style={{
                  margin: '4px 0',
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: isTask !== undefined && !checked ? '#a8a08e' : '#d8cfa8',
                  position: 'relative',
                }}
              >
                {isTask !== undefined && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 14,
                      marginRight: 8,
                      marginLeft: -22,
                      border: '1px solid rgba(184, 137, 58, 0.4)',
                      borderRadius: 2,
                      background: checked ? 'rgba(127, 192, 144, 0.2)' : 'transparent',
                      color: '#7fc090',
                      fontSize: 10,
                      lineHeight: '12px',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                    }}
                  >
                    {checked ? '✓' : ''}
                  </span>
                )}
                {it}
              </li>
            );
          })}
        </ul>
      );
      listBuffer = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Empty line
    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      flushList();
      nodes.push(
        <h3
          key={key++}
          style={{
            fontSize: 14,
            color: '#a78bfa',
            margin: '16px 0 6px',
            letterSpacing: '0.05em',
            fontWeight: 600,
          }}
        >
          {parseInline(line.slice(4))}
        </h3>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      nodes.push(
        <h2
          key={key++}
          style={{
            fontSize: 17,
            color: '#e0b060',
            margin: '20px 0 8px',
            letterSpacing: '0.05em',
            fontWeight: 700,
            paddingBottom: 4,
            borderBottom: '1px solid rgba(184, 137, 58, 0.2)',
          }}
        >
          {parseInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      nodes.push(
        <h1
          key={key++}
          style={{
            fontSize: 22,
            color: '#e0b060',
            margin: '8px 0 12px',
            letterSpacing: '0.05em',
            fontWeight: 700,
          }}
        >
          {parseInline(line.slice(2))}
        </h1>
      );
      continue;
    }

    // Horizontal rule
    if (line === '---') {
      flushList();
      nodes.push(
        <hr
          key={key++}
          style={{
            border: 'none',
            borderTop: '1px dashed rgba(184, 137, 58, 0.25)',
            margin: '20px 0',
          }}
        />
      );
      continue;
    }

    // List items
    const taskMatch = line.match(/^(\s*)- \[([ xX])\]\s+(.*)$/);
    const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (taskMatch) {
      const text = taskMatch[3];
      const checked = taskMatch[2].toLowerCase() === 'x';
      if (!listBuffer) listBuffer = { items: [], tasks: [] };
      if (!listBuffer.tasks) listBuffer.tasks = [];
      listBuffer.items.push(parseInline(text));
      listBuffer.tasks.push(checked);
      continue;
    }
    if (listMatch) {
      const text = listMatch[2];
      if (!listBuffer) listBuffer = { items: [], tasks: null };
      listBuffer.items.push(parseInline(text));
      if (listBuffer.tasks) listBuffer.tasks.push(false);
      continue;
    }

    // Paragraph
    flushList();
    // Italic-only line (single asterisks at start/end) → 引用样式
    if (/^\*[^*].+[^*]\*$/.test(line)) {
      nodes.push(
        <p
          key={key++}
          style={{
            margin: '8px 0',
            fontSize: 12,
            fontStyle: 'italic',
            color: '#8a8576',
            paddingLeft: 12,
            borderLeft: '2px solid rgba(184, 137, 58, 0.3)',
          }}
        >
          {parseInline(line)}
        </p>
      );
      continue;
    }
    nodes.push(
      <p
        key={key++}
        style={{
          margin: '6px 0',
          fontSize: 13,
          lineHeight: 1.7,
          color: '#d8cfa8',
        }}
      >
        {parseInline(line)}
      </p>
    );
  }
  flushList();
  return nodes;
}

/**
 * 行内解析：bold / italic / code / link
 */
function parseInline(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  let i = 0;
  let key = 0;
  let buffer = '';

  const flush = () => {
    if (buffer) {
      result.push(buffer);
      buffer = '';
    }
  };

  while (i < text.length) {
    const rest = text.slice(i);

    // **bold**
    const boldMatch = rest.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      flush();
      result.push(
        <strong key={key++} style={{ color: '#f5f0e0', fontWeight: 600 }}>
          {boldMatch[1]}
        </strong>
      );
      i += boldMatch[0].length;
      continue;
    }

    // *italic*
    const italicMatch = rest.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      flush();
      result.push(
        <em key={key++} style={{ color: '#a8a08e', fontStyle: 'italic' }}>
          {italicMatch[1]}
        </em>
      );
      i += italicMatch[0].length;
      continue;
    }

    // `inline code`
    const codeMatch = rest.match(/^`([^`]+)`/);
    if (codeMatch) {
      flush();
      result.push(
        <code
          key={key++}
          style={{
            background: 'rgba(184, 137, 58, 0.15)',
            color: '#f4a8c0',
            padding: '1px 6px',
            borderRadius: 3,
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        >
          {codeMatch[1]}
        </code>
      );
      i += codeMatch[0].length;
      continue;
    }

    // [text](url)
    const linkMatch = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      flush();
      result.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#a5c8ff', textDecoration: 'underline' }}
        >
          {linkMatch[1]}
        </a>
      );
      i += linkMatch[0].length;
      continue;
    }

    buffer += text[i];
    i++;
  }
  flush();
  return result;
}


// ============================================================================
// S2-A: 节气公告管理（动态前置内容）
// ============================================================================

const SOLAR_TERM_NOTICE_KEY = 'cua-yuanye-solar-term-notice-v1';

interface SolarTermNotice {
  term: string;
  description: string;
  recordedAt: number;
}

/** 记录最新节气切换 */
export function recordSolarTermNotice(term: string, description: string): void {
  try {
    const notice: SolarTermNotice = {
      term,
      description,
      recordedAt: Date.now(),
    };
    localStorage.setItem(SOLAR_TERM_NOTICE_KEY, JSON.stringify(notice));
    invalidateAnnouncementsCache();
  } catch {
    // ignore
  }
}

/** 读出最新节气公告（如果有，3 天内有效）*/
function readSolarTermNotice(): SolarTermNotice | null {
  try {
    const raw = localStorage.getItem(SOLAR_TERM_NOTICE_KEY);
    if (!raw) return null;
    const notice = JSON.parse(raw) as SolarTermNotice;
    // 3 天内的节气公告才显示（之后会被新的覆盖或过期）
    if (Date.now() - notice.recordedAt > 3 * 24 * 60 * 60 * 1000) return null;
    return notice;
  } catch {
    return null;
  }
}

/**
 * 拼接节气公告 + 主公告内容
 * 在 fetchAnnouncements 已经返回的 markdown 前面插入节气段
 */
export function prependSolarTermNotice(markdown: string): string {
  const notice = readSolarTermNotice();
  if (!notice) return markdown;

  const ageHours = Math.floor((Date.now() - notice.recordedAt) / (60 * 60 * 1000));
  const ageLabel = ageHours < 1 ? '刚刚' : ageHours < 24 ? `${ageHours} 小时前` : `${Math.floor(ageHours / 24)} 天前`;

  const noticeMd = `## ✦ 节气更迭 · 「${notice.term}」 ✦

*${notice.description}（${ageLabel}）*

---

`;

  return noticeMd + markdown;
}
