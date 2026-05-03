# CUA 基地 v2.0 · UI 全面像素化

> _一个独立开发者 · 跨 10 次会话 · 16 个面板 · 6707 行删除 · 5000 行新增_
>
> _2026-04-29_

---

CUA 基地（CUA Base）是为 [WebAgentLab](https://github.com/WebAgentLab) 开源社区打造的一个像素风浏览器协作平台。从 2026-04 开始，整个 UI 经历了一次全面重构 —— 从原来的**深色科技 UI** 迁移到**像素古籍风 UI**。

今天，**Wave 2 完成了**。

---

## 为什么要重构

CUA 基地原本的 UI 是典型的深色科技风：黑底、金边、衬线字。功能上能用，但美学上跟项目本身的精神**不匹配**。

我想做的是一个**协作工坊**，而不是一个 dashboard。

工坊应该是：

- 有**纸张**的质感
- 有**木刻**的肌理
- 有**像素**的克制
- 有**古籍**的呼吸感

宋代雕版印刷 + 8-bit 像素 —— 这是我想要的视觉。

---

## 9 个子波

完整 UI 重构被拆成了 **9 个子波**，跨大约 10 次跟 Claude 的协作会话完成：

| 子波 | 内容 |
|---|---|
| 2.1 | NewGameAppHUD（10 个 HUD 组件 + design-system.css） |
| 2.2.A | 5 hooks + 替换 4 个 HUD 旧组件 |
| 2.3.A | NewChatPanel 世界频道（380×520） |
| 2.3.B | NewChatPanel 完整版（3 频道 + 用户搜索） |
| 2.4 | NewMailBox + NewFriendsPanel |
| 2.5.A | NewAnnouncementPanel + QuestLog 桥接 |
| 2.5.A.2 | NewQuestLog 80% 视觉 |
| 2.5.B | 议政 3 panel（CreateProposal / ProposalList / AppealDesk） |
| 2.5.C | HomeWall + MeritBoard + Roadmap |
| 2.6 | 删 16 个旧组件 + 清理 App.tsx |

每个子波都是**独立可发布**的 —— 装上能跑、有 README、有测试清单、有紧急回滚路径。

---

## 工程教训

### 1. 不要在聊天里直接复制代码到 PowerShell

中间出过一个**鬼故事级**的 bug：

我在聊天里写了一段 PowerShell 命令：

```powershell
setExpandedId(isExpanded ? null : quest.id)
```

聊天界面把 `quest.id` 自动**渲染成了超链接** —— 当用户复制回 PowerShell 跑时，文件里就变成了：

```typescript
setExpandedId(isExpanded ? null : [quest.id](http://quest.id))
```

TypeScript 不会报错（因为 `[quest.id]` 是合法的数组语法），但运行时 `setExpandedId` 收到的是数组对象，不是字符串。React 比较不上 → **任务卡完全点不开**。

**教训**：所有代码用 zip 文件传 · 永远不直接粘聊天里的 JS/TS。

### 2. 旧组件 ≠ 一定要删

Wave 2.6 删 16 个旧组件之前，我先做了**全局扫描**：

```powershell
Get-ChildItem -Path src -Recurse -Include *.tsx,*.ts |
  Select-String -Pattern "from\s+['\""]\.[/\\](components[/\\])?(HUD|...)['\""]" |
  Format-Table Path, LineNumber, Line
```

结果：**只有 App.tsx 引用** —— 其他 30+ 个 keyListener / Processor / 教程组件**完全没引用**这些旧组件。

如果直接删 · 大概率有 `KeyListener` 仍 import 已删组件 · 全瘫。

**教训**：删之前**强制扫描** · 删之后**强制验证**。

### 3. 不要硬干 1052 行的组件

QuestLog.tsx 是 1052 行的怪物 · 内含 5 任务 + 接受流 + 提交流 + URL 验证 + 撤回倒计时 + 3 审核员投票 + 申诉流 + 申诉投票。

完整重写要 12-15h —— **一次会话做不完**。

最终选择了 **80% 视觉重写** —— 列表 + 任务卡 + 提交表单 重新做 · 撤回 / 审核投票 / 申诉**沿用旧逻辑**（沿用 questStore API）。

**教训**：不是所有重构都要 100% · 80/20 法则适用于代码。

### 4. CSS variables 是设计系统的命脉

`src/styles/design-system.css` 定义了**整个项目**的视觉 token：

```css
--paper-0: #f5ecd9;    /* 最浅 */
--paper-1: #ede1c8;
--paper-2: #dccfae;
--paper-3: #cdbe96;    /* 最深 */

--wood-3: #5a4329;     /* 主标题色 */
--gold: #c8a55b;       /* 强调色 */
--danger: #a64634;     /* 错误色 */
```

16 个新 panel 不直接写 hex 值 —— 全部用 `var(--paper-1)` / `var(--gold)` 等 token。

**好处**：未来想改主色调（比如做"夜间模式"或"清明特别版"）—— 改 design-system.css 一处即可。

---

## 数据

```
9 个子波 · 跨 ~10 次会话
16 个旧组件删除（共 6707 行）
16 个新 New* 组件（共 ~5000 行）
18 个新 hooks
7 个共享 UI 组件
1 个 design-system.css

TS strict 0 错误
Vite build 通过
8 项关键路径手动测试 pass
```

---

## 下一步

Wave 2 完成了 · 但这只是**视觉**的完成。

接下来的 **Wave 3** 重点会从"美化"转向"协作"：

- **真任务源** · 从 5 个虚构任务，迁向 GitHub Issues 双向同步
- **实时多人** · Phaser 场景里同屏 10+ 玩家
- **真审核员** · 现在是模拟 reviewer · 后续接入真社区成员
- **审核投票动画** · 现在是静态 N/3 · 加投票轨迹动画

但在那之前 —— 先**找用户测**。

代码再漂亮，没人玩就只是自娱自乐。

---

## 链接

- GitHub: [Leoatsr/cua-base](https://github.com/Leoatsr/cua-base)
- 分支: `ui-redesign`
- 详细文档: [docs/wave-2-summary.md](https://github.com/Leoatsr/cua-base/blob/ui-redesign/docs/wave-2-summary.md)
- 完整变更: [CHANGELOG.md](https://github.com/Leoatsr/cua-base/blob/ui-redesign/CHANGELOG.md)

---

**作者**：Leoatsr
**写于**：2026-04-29，东京 门前仲町
**协作**：Claude (Anthropic)
