# Wave 2 · UI 重构总结

> _16 个面板 · 9 个子波 · 像素古籍风全面替换深色 UI · 2026-04 完成_

---

## 总览

Wave 2 是 CUA 基地从**深色科技 UI**迁移到**像素古籍风 UI** 的完整重写工程。完成后：

- ✅ 删除 16 个旧组件（共 6707 行）
- ✅ 新增 16 个 New* 像素面板（共 ~5000 行）
- ✅ 18 个新 hooks（功能解耦）
- ✅ 7 个共享 UI 组件 + design-system.css
- ✅ TypeScript 严格模式 0 错误
- ✅ Vite build 通过

---

## 9 个子波

| 子波 | 内容 | 工作量 |
|---|---|---|
| **2.1** | NewGameAppHUD（10 个 HUD 子组件 + design-system.css）| 大 |
| **2.2.A** | 5 hooks + 替换 4 个旧 HUD 组件 | 中 |
| **2.3.A** | NewChatPanel 世界频道（380×520）| 中 |
| **2.3.B** | NewChatPanel 完整版（480×560 · 3 频道 + sidebar + 用户搜索 + 未读计数）| 大 |
| **2.4** | NewMailBox + NewFriendsPanel | 大 |
| **2.5.A** | NewAnnouncementPanel + QuestLog 桥接 | 小 |
| **2.5.A.2** | NewQuestLog 80% 视觉（4 status tab + 任务卡 + 提交表单）| 大 |
| **2.5.B** | 议政 3 panel（CreateProposal / ProposalList / AppealDesk）| 大 |
| **2.5.C** | HomeWall + MeritBoard + Roadmap | 大 |
| **2.6** | 删除 16 个旧组件 + App.tsx 清理 | 中 |

---

## 旧组件 → 新组件映射

| 旧组件 | 新组件 | 触发 | 子波 |
|---|---|---|---|
| `HUD.tsx` | `NewGameAppHUD.tsx` (整体 HUD) | 始终显示 | 2.1 |
| `CVDisplay.tsx` | `CVBar` (在 NewGameAppHUD 内) | 始终显示 | 2.1 |
| `LevelBadge.tsx` | `AvatarPanel` (左上 NewGameAppHUD) | 始终显示 | 2.1 |
| `TimeHUD.tsx` | `TopRightChips` (在 NewGameAppHUD 内) | 始终显示 | 2.1 |
| `ChatPanel.tsx` | `NewChatPanel.tsx` | T 键 / 5 图标 💬 | 2.3 |
| `MailBox.tsx` | `NewMailBox.tsx` | K 键 / 5 图标 ✉ | 2.4 |
| `FriendsPanel.tsx` | `NewFriendsPanel.tsx` | F 键 / 5 图标 👥 | 2.4 |
| `QuestLog.tsx` | `NewQuestLog.tsx` | J 键 / 5 图标 📋 | 2.5.A.2 |
| `AnnouncementButton.tsx` | `NewAnnouncementPanel.tsx` | 5 图标 📜 | 2.5.A |
| `CreateProposalPanel.tsx` | `NewCreateProposalPanel.tsx` | 议政厅讲坛 [E] | 2.5.B |
| `ProposalListPanel.tsx` | `NewProposalListPanel.tsx` | 议政厅公告板 [E] | 2.5.B |
| `AppealDeskPanel.tsx` | `NewAppealDeskPanel.tsx` | 明镜阁案桌 [E] | 2.5.B |
| `HomeWallPanel.tsx` | `NewHomeWallPanel.tsx` | 自家小屋墙 [E] | 2.5.C |
| `MeritBoardPanel.tsx` | `NewMeritBoardPanel.tsx` | 功德堂中央碑石 [E] | 2.5.C |
| `RoadmapPanel.tsx` | `NewRoadmapPanel.tsx` | 远见塔 [E] | 2.5.C |
| `PanelToggleBridge.tsx` | _(已废弃 · 各 panel 自己监听)_ | — | 2.6 |

---

## 设计系统

### 配色 · CSS Variables

```css
/* 纸张层次 */
--paper-0: #f5ecd9;    /* 最浅 · 主背景 */
--paper-1: #ede1c8;    /* 浅 · 卡片/header */
--paper-2: #dccfae;    /* 中 · sidebar */
--paper-3: #cdbe96;    /* 深 · 框架/边框 */

/* 木色 · 边框 + 标题 */
--wood-1: #8a6f4a;
--wood-2: #6b513a;
--wood-3: #5a4329;     /* 主标题色 */
--wood-4: #3d2c1a;     /* 最深边框 */

/* 强调色 */
--gold: #c8a55b;       /* 金色 · 强调 / 选中 */
--danger: #a64634;     /* 红色 · 错误 / 申诉 */

/* 墨色 · 正文 */
--ink: #2a2218;
--ink-faint: #6b5e4f;

/* 语义色（chip 用）*/
--spring: #7fc090;     /* 春色 · success */
--jade: #90c0e0;       /* 玉色 · info */
```

### 字体

| 用途 | 字体 |
|---|---|
| 像素标题 / pixel UI | `var(--f-pixel)` (Ma Shan Zheng / ZCOOL XiaoWei) |
| 正文 | `var(--f-sans)` (霞鹜文楷 / system) |
| 数字 / mono | `var(--f-num)` (JetBrains Mono / Inter) |

### 共享 UI 组件 (`src/ui/`)

```
PixelPanel    像素古籍风容器（边角 4×4 木色块）
PixelButton   按钮 (variant: pb-primary / pb-ghost · size: pb-sm / pb-lg)
Sprite        像素 sprite 渲染（char / item / icon）
TileMap       SVG tile 地图（Wave 2.1 GameViewPreview 用）
Banner        节气 banner（春/夏/秋/冬 4 色调）
Chip          标签 chip（tone: spring / gold / jade / danger）
Divider       分隔线（sm 短 · 默认长）
```

---

## Hook 清单

`src/hooks/` 提供的 18 个 hook：

| Hook | 数据源 | 用途 |
|---|---|---|
| `useProfile` | profileStore | 当前用户资料 |
| `useCV` | cv.ts | CV 总数 + entries |
| `useLevel` | levelStore | 等级信息（带 next 升级条件） |
| `useGameTime` | timeStore | 游戏内时间（季节 / 节气 / 时辰） |
| `useOnlineCount` | realtimePresence | 在线人数（全站 / 当前场景） |
| `useChatMessages` | chatStore EventBus | 聊天实时消息 |
| `useChatHistory` | chatStore | 拉历史 + 监听新消息合并 |
| `useToggleViaEventBus` | EventBus | 监听旧 toggle-XXX 事件 |
| `useOpenViaEventBus` | EventBus | 监听旧 open-XXX 事件 + 新 toggle-panel |
| `useCurrentScene` | chatManager | 当前 scene key |
| `usePrivateConversations` | chatManager | 私聊 conversation 列表 |
| `useUnreadCounts` | EventBus | 3 频道独立未读计数 |
| `useMail` | mail.ts | 邮件列表 + 未读 |
| `useFriends` | friendsStore | 好友 + 请求 |
| `useFollows` | followsStore | 关注 + 粉丝 |
| `useAnnouncements` | announcementsStore | 公告 markdown + 已读 fingerprint |
| `useQuestStates` | questStore | 任务状态机（useSyncExternalStore） |
| `useProposals` | proposalStore | 提案列表 + realtime |
| `useLeaderboard` | get_cv_leaderboard RPC | CV 排行榜 |
| `useHomeWallData` | (聚合多源) | 个人成就墙数据 |

---

## 关键决策 / 权衡

### 决策 1 · QuestLog 80% 视觉重写

**原 QuestLog 1052 行**深度耦合：5 任务定义 + 接受流 + 提交流 + URL 验证 + 撤回倒计时 + 3 审核员投票 + 申诉流 + 申诉投票。

**全完整重写需要 12-15h** · 一个会话做不完。

**最终选择**：
- ✅ 列表 + tab + 任务卡 + 提交表单 · 完全重写（80% 视觉）
- ✅ 撤回流 · 简化（无 1s tick）
- ⏳ 审核投票动画 / 申诉流 · 留给 Wave 2.5.A.3+

### 决策 2 · 抽 QUESTS 数组到 lib

**问题**：旧 QuestLog 把 5 任务**硬编码**在组件里 · NewQuestLog + AppealDeskPanel **都需要**同一份数据。

**解决**：抽到 `src/lib/questDefinitions.ts` —— single source of truth。

同样的策略：`src/lib/roadmapData.ts`（5 阶段路线图数据）也抽出来。

### 决策 3 · useOpenViaEventBus 双监听

**问题**：旧 keyListener emit `open-mailbox` / `open-friends-panel` 等单独事件 · 新 NewGameAppHUD 5 图标 emit `toggle-panel { panel: 'mail' }` · **格式完全不兼容**。

**解决**：写 `useOpenViaEventBus(panelName, legacyOpenEvent)` —— 两边都监听，都能正确 toggle。

```typescript
// 旧事件 = 打开（单纯 setOpen(true)）
EventBus.on(legacyOpenEvent, () => setOpen(true));

// 新事件 = toggle
EventBus.on('toggle-panel', (data) => {
  if (data.panel === panelName) setOpen(prev => !prev);
});
```

### 决策 4 · localStorage keys 保留旧名

**问题**：项目从源野物语（cua-yuanye-spike）改名 CUA 基地 · localStorage keys 全是 `cua-yuanye-XXX-v1`。

**决策**：**保留旧名** — 改了就丢失现有用户数据。CUA 基地只是品牌名 · 内部代码 ID 仍可叫 yuanye。

### 决策 5 · 不破坏 Phaser 场景层

NewGameAppHUD 是 React DOM overlay · **从不**碰 Phaser canvas。所有 Phaser 场景（萌芽镇 / 共创之都 / 议政高地 / 明镜阁等）保持 100% 不变。

---

## 兼容性保证

✅ **完整保留**：
- `KeyListener` 系列（T/K/F/J/P 键监听）
- `ReviewProcessor` / `AppealProcessor`（headless · 处理审核投票事件）
- `TitleScreen`（登录前主屏）
- `TutorialOverlay`（教程系统）
- `SolarTermBanner`（节气 banner）
- `NotificationToast`（toast 系统）
- `LevelUpAnimation`（升级动画）
- `FaceCustomizer` / `ProfilePanel`（P 键打开）
- `DialogueBox`（NPC 对话）
- `WorldMap`（地图）
- 所有 EventBus 事件（reviewer-vote-cast / quest-finalized / appeal-* 等）
- 所有 Supabase RLS / RPC（get_cv_leaderboard / send_friend_request 等）

---

## 已知限制 · 留给 Wave 3+

- ⚠️ **QuestLog 撤回倒计时不实时刷新**（无 1s tick）· 状态变化时才刷新
- ⚠️ **审核投票无动画**（仅静态 N/3 进度）
- ⚠️ **CV 入账无动画**（直接显示金额）
- ⚠️ **议政厅 NPC 对话**仍是旧 DialogueBox · 暂不重写
- ⚠️ **HomeWall CV entries 限制 10 条**显示
- ⚠️ **MeritBoard 等级估算**不含 proposal_count（RPC 不返回）

---

## 工具教训

### markdown 链接污染

**症状**：粘贴 PowerShell 命令到聊天 → 自动渲染 `quest.id` 为超链接 → 复制回 PowerShell 时变成 `[quest.id](http://quest.id)` 写入文件。

**预防**：
- 永远用 zip 文件传代码 · 不在聊天里直接粘代码块到 PowerShell
- PowerShell 里**显示**文件内容看到 `[xxx](http://xxx)` 不一定是文件污染（可能是聊天界面渲染）
- 文件污染检测：`Select-String -Pattern '\]\(http' -Path src\**\*.tsx`

### 重复 import bug

**症状**：跑同一条 `$content.Replace($oldImport, $newImport)` 命令两次 → import 行重复 → Vite `Identifier already declared` 报错。

**预防**：用 `$dup`（2 行重复）替换为 `$single`（1 行）的方式做幂等修复脚本。

---

## Wave 2 数据

```
9 个子波 · 跨 ~10 次会话
16 个旧组件删除（共 6707 行删）
16 个新 New* 组件（共 ~5000 行新增）
18 个新 hooks
7 个共享 UI 组件
1 个 design-system.css

TS 0 错误 · Vite build 通过 · 8 项关键路径测试全过
```

---

_最后更新：2026-04-29_
