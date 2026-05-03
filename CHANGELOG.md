# Changelog

All notable changes to CUA 基地 (CUA Base) are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

---

## [Unreleased] · ui-redesign branch

### Wave 2.6 (2026-04-29) · 收尾清理

**Removed**
- 16 legacy components (6707 lines deleted):
  - `HUD.tsx` / `CVDisplay.tsx` / `LevelBadge.tsx` / `TimeHUD.tsx` (replaced by NewGameAppHUD)
  - `ChatPanel.tsx` / `MailBox.tsx` / `FriendsPanel.tsx` / `QuestLog.tsx` (replaced by New* counterparts)
  - `AnnouncementButton.tsx` (replaced by NewAnnouncementPanel)
  - `CreateProposalPanel.tsx` / `ProposalListPanel.tsx` / `AppealDeskPanel.tsx`
  - `HomeWallPanel.tsx` / `MeritBoardPanel.tsx` / `RoadmapPanel.tsx`
  - `PanelToggleBridge.tsx` (transitional helper, no longer needed)

**Changed**
- Cleaned 16 dead imports from `src/App.tsx`
- Removed `<AnnouncementButton />` JSX render

**Verified**
- Global grep: 0 residual references
- TS strict mode: 0 errors
- Vite build: pass
- 8 关键路径手动测试: pass

### Wave 2.5.C (2026-04-29) · 远见塔/功德堂/自家小屋

**Added**
- `NewHomeWallPanel.tsx` (600×620) · 自家小屋纪念墙 · 个人成就时间轴
- `NewMeritBoardPanel.tsx` (540×620) · 功德堂 CV 排行榜 · 前 3 名金/银/铜大行
- `NewRoadmapPanel.tsx` (600×620) · 远见塔 5 阶段路线图 · 进度条 + ↓ 阶段箭头
- `useHomeWallData` · `useLeaderboard` (含 estimateLevel) · `roadmapData.ts`

### Wave 2.5.B (2026-04-29) · 议政 3 panel

**Added**
- `NewCreateProposalPanel.tsx` (540×600) · 5 类别 + 4 时长 + L2 守门
- `NewProposalListPanel.tsx` (600×620) · 提案列表 + 类别筛选 + 投票（赞/反/弃 + 备注）+ L1 守门
- `NewAppealDeskPanel.tsx` (540×600) · 任务申诉案桌（明镜阁）
- `useProposals` hook · realtime + lazy finalize

### Wave 2.5.A.2 (2026-04-29) · NewQuestLog 80% 视觉

**Added**
- `NewQuestLog.tsx` (540×600) · 4 status tab（可接 / 进行中 / 审核中 / 已完成）
- `QuestCard.tsx` · button-based · 折叠详情
- `SubmissionForm.tsx` · URL 验证 + 自评 + 评分细则
- `useQuestStates` hook · useSyncExternalStore + ensureQuestStates
- 抽 5 任务数组到 `src/lib/questDefinitions.ts`

**Fixed**
- markdown 链接污染（`quest.id` 在 PowerShell 命令复制时变成 `[quest.id](http://quest.id)`）

### Wave 2.5.A (2026-04-29) · 公告板 + QuestLog 桥接

**Added**
- `NewAnnouncementPanel.tsx` (560×600) · markdown render + 节气历史
- `useAnnouncements` hook · 已读 fingerprint
- `PanelToggleBridge` (后续 2.5.A.2 移除)

### Wave 2.4 (2026-04-29) · 邮件 + 社交

**Added**
- `NewMailBox.tsx` (480×560) · sidebar + 详情 · 5 类别（系统/审核/裁定/申诉/CV）
- `NewFriendsPanel.tsx` (480×560) · 4 tab（好友/请求/关注/粉丝）+ 加好友搜索
- 4 hooks: `useMail` / `useFriends` / `useFollows` / `useOpenViaEventBus`
- `MailItem` / `FriendItem` 共享单项组件

### Wave 2.3.B (2026-04-29) · ChatPanel 完整版

**Added**
- `NewChatPanel.tsx` 升级到 480×560 · 3 频道全部激活（world/scene/private）
- 私聊 sidebar + recipient 切换
- G2-D 用户名搜索（fetchProfileByUsername）
- 各 tab 独立未读角标
- 4 hooks: `useCurrentScene` / `usePrivateConversations` / `useChatHistory` / `useUnreadCounts`

### Wave 2.3.A (2026-04-29) · ChatPanel 世界频道

**Added**
- `NewChatPanel.tsx` 像素风重写（380×520）· 仅世界频道
- 5s 冷却 + 200 字符限制
- 头像渲染（GitHub avatar / fallback Sprite）
- 时间相对格式（刚刚 / N 分前 / HH:MM）
- 2 hooks: `useChatMessages` / `useToggleViaEventBus`

### Wave 2.2.A (2026-04-29) · 5 hooks + HUD 替换

**Added**
- 5 hooks: `useProfile` / `useCV` / `useLevel` / `useGameTime` / `useOnlineCount`
- `LEVEL_THRESHOLDS = [0, 100, 500, 1500, 5000]`

**Removed (HUD 替换)**
- `HUD.tsx` / `CVDisplay.tsx` / `LevelBadge.tsx` / `TimeHUD.tsx`

**Changed**
- 5 图标按钮 emit `toggle-panel { panel: 'announcement' | 'questlog' | 'mail' | 'chat' | 'friends' }`

### Wave 2.1 (2026-04-29) · NewGameAppHUD

**Added**
- 10 个 HUD 组件 in `src/ui/hud/`:
  - `AvatarPanel` · `CVBar` · `TopRightChips` · `Minimap` · `QuestCard`
  - `IconBar` · `Hotbar` · `DialogueBox` · `HelpButton` · `KeyHint`
- 8 个共享 UI 组件 in `src/ui/`:
  - `PixelPanel` · `PixelButton` · `Sprite` · `TileMap` · `Banner` · `Chip` · `Divider`
- `gameMeta.ts` · 3 REGIONS / 9 WORKSHOPS / 6 NPCS / 5 LEVELS
- `LandingPage.tsx` (路径 `/`)
- `ComingSoon.tsx` (路径 `/manual` `/codex` `/maps`)
- `design-system.css` · 像素古籍风 CSS variables + 字体 + 共享类
- React Router 7 路由

---

## Wave 1 (Pre-2.0) · 基础架构

详见 git log 历史 commits。

---

_Project：CUA 基地 (CUA Base)  ·  Branch：ui-redesign  ·  Last sync：2026-04-29_
