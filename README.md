# CUA 基地 · CUA Base

> 像素 MMO 雏形 — 为 **WebAgentLab 开源社区** 构建的游戏化贡献协作平台

[![Live](https://img.shields.io/badge/Live-cua--base.vercel.app-7fc090?style=flat-square)](https://cua-base.vercel.app)
[![Tech](https://img.shields.io/badge/Tech-Vite%208%20%2B%20React%2019%20%2B%20Phaser%203.90-3d5a78?style=flat-square)]()
[![Status](https://img.shields.io/badge/Phase-3.0%20多人在场-b8893a?style=flat-square)]()

---

## 这是什么

**CUA 基地（CUA Base）** 是一个用游戏化方式呈现 Web Agent 开源社区贡献协作流程的像素 MMO 雏形。玩家以贡献者身份进入游戏，通过完成任务获得 CV（Contribution Value，贡献价值），逐步解锁议政高地、参与提案投票、共建社区基础设施。

核心循环：

```
GitHub 登录 → 进入萌芽镇 → 探索 9 工坊 → 接任务 → 完成 → 审核 → CV 入账 → 升级 → 解锁议政
```

## 核心功能

### 🌱 世界与地图
- 萌芽镇（新人起点）+ 共创之都 9 工坊（开元楼/明镜阁/承文堂/远见塔/...）
- 议政高地三建筑（提案 / 投票 / 申诉）
- 大集会广场 + 自家小屋
- 14 个 Phaser scene 全部接入实时同步

### 🤝 多人系统（轻量版）
- Supabase Realtime 实时玩家位置 + scene 切换
- 完整聊天（世界 / 私聊 / scene-local）
- 好友系统 + 跨场景在线状态
- 关注系统 + 8 古风表情快捷键
- E 键玩家互动菜单

### 📋 任务与审核
- 9 大裂变任务定义 + 5 新手任务
- 3 AI 审核员投票模拟（周明 / 严之 / 白徽）
- CV 入账 + 邮件通知 + 申诉流程
- 任务历史 + 全社区时间线
- 通知系统 + 红点提醒

### 👤 用户系统
- GitHub OAuth 登录（Supabase Auth）
- 4×4×4 捏脸（24 像素人像组合）
- L0-L4 等级系统 + 区域权限
- 个人资料面板（P 键）+ 公开页 `/u/{username}`

### 📊 季节昼夜系统
- 时间引擎：48 现实分钟 = 1 游戏日
- 24 节气循环（立春 → ... → 大寒）
- 全屏昼夜 overlay + 季节 tint
- NPC 时段问候（清晨/白昼/黄昏/夜晚 4×4 句）
- 节气切换 banner + 自动公告板更新
- 时间倍率调节（1x / 4x / 24x / 60x）

### 📜 教程与公告
- 公告板（左下 📜，Markdown 驱动）
- 6 tab 完整玩家手册（右下 ?）
- 24 step 互动教程（toast + 高亮 + 进度条）
- 节气切换自动通知

### 📈 数据看板
- 7 tab 数据看板（用户 / 内容 / 社交 / 错误 / 留存 / Session / 总览）
- session tracking + 7d/30d/90d 留存曲线
- 管理员白名单访问

## 技术栈

- **前端**：Vite 8 + React 19 + TypeScript（严格模式）
- **游戏引擎**：Phaser 3.90
- **样式**：Tailwind CSS
- **多人同步**：Supabase Realtime
- **数据库**：Supabase Postgres（25 张表 + RLS）
- **认证**：Supabase Auth + GitHub OAuth
- **错误监控**：Sentry
- **部署**：Vercel（自动从 GitHub main 部署）
- **路由**：react-router-dom

## 本地开发

### 准备工作

需要：
- Node.js 20+
- pnpm 10+
- Supabase 项目 + GitHub OAuth App

### 启动

```bash
git clone https://github.com/Leoatsr/cua-base.git
cd cua-base
pnpm install

# 创建 .env.local
cp .env.example .env.local
# 填入 VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

# 跑数据库迁移（25 SQL 全部执行）
# 在 Supabase Dashboard → SQL Editor → 按顺序执行 sql/001-023

# 启动 dev
pnpm dev
```

打开 `http://localhost:5173/`

## 项目结构

```
cua-base/
├── src/
│   ├── App.tsx                 # 入口 + 路由 + 全局状态启动
│   ├── main.tsx
│   ├── components/             # React UI 组件（45+）
│   │   ├── HUD.tsx
│   │   ├── TitleScreen.tsx
│   │   ├── ManualPanel.tsx
│   │   ├── DashboardPanel.tsx
│   │   └── ... (40+ panels)
│   ├── game/
│   │   ├── EventBus.ts         # React ↔ Phaser 通信
│   │   ├── PhaserGame.tsx
│   │   ├── faceRenderer.ts
│   │   ├── entities/           # NPC / SignPost / RemotePlayer
│   │   └── scenes/             # 18 Phaser scenes
│   ├── lib/                    # 业务逻辑层（30+）
│   │   ├── supabase.ts
│   │   ├── authStore.ts
│   │   ├── timeStore.ts        # 时间引擎
│   │   ├── tutorialStore.ts    # 教程状态机
│   │   └── ... (28+ stores)
│   └── hooks/
├── public/
│   ├── assets/                 # 像素 sprites + tilesets + maps
│   └── announcements.md        # 公告内容（用户改这个文件）
├── sql/                        # 25 个迁移文件
│   ├── 001_cv_entries.sql
│   ├── ...
│   └── 023_user_sessions.sql
├── docs/
└── README.md
```

## 开发节奏（v3 实际进度 · 4/28）

```
第 1-4 周  · Phase 1+2: 单镇 + AI 审核闭环 ✓
第 5-6 周  · Phase 4: 议政高地 + 提案投票 + 9 工坊室内 ✓
第 7-8 周  · Phase 3: 多人在场（Supabase Realtime） ✓
第 9 周   · J2 数据看板 + Pub2 教程 + S1/S2-A 时间系统 ✓
第 10+ 周 · Phase 2.5: GitHub Issues 真任务源（关键拐点）
```

完整 roadmap 见 `docs/roadmap.html`。

## 路线图（剩下最重要的事）

按优先级：

1. 🔴 **真用户测试** — 最高 ROI
2. 🔴 **D6-new GitHub Issues 双向同步** — 从"游戏内任务"到"真实可贡献"
3. 🔴 **A8 中国大陆访问** — ICP 备案 / EdgeOne / 微信小程序
4. 🟡 **E9-new 真审核员** — 替代 AI 模拟
5. 🟡 **J8-new CV 排行榜公开页**
6. 🟢 **S2-B Phaser scene 真改** — 沉浸感
7. 🟢 **G7-B 礼物系统**

## 设计原则

- ✨ **不为游戏化而游戏化** — 每个机制要回归"是否让贡献变得更顺畅、更被看见"
- 🌸 **古典中国语境** — 工坊命名 / NPC 名字 / 节气循环都来自传统文化
- 🤝 **以社区为本** — 游戏是放大器，WebAgentLab 社区本身的价值才是底层资产
- 🛠️ **独立开发友好** — 单文件 SKILL.md 优先 / 不依赖企业服务 / 免费档优先

## 致谢

- WebAgentLab 开源社区
- Supabase + Vercel + GitHub 免费档
- Anthropic Claude（开发协作）
- 所有早期测试者

## License

MIT — 详见 [LICENSE](./LICENSE)

---

**Live**: https://cua-base.vercel.app  
**仓库**: https://github.com/Leoatsr/cua-base  
**文档**: 项目内 `docs/` 目录
