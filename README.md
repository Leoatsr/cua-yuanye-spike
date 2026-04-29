# Wave 2.5.A.2 · NewQuestLog 视觉壳重写（80%）

UI 重构第 2 波 · 第 7 步 — **任务日志像素化**

---

## 这一波做了什么

### 范围（80% 视觉）

✅ 完全重写：
- 任务列表 + 4 status tab（可接 / 进行中 / 审核中 / 已完成）
- 任务卡片（标题 / 工坊 / CP / 难度 / 折叠详情）
- 接受任务 → `acceptQuest` API
- 提交表单（URL + 自评 + 评分细则提示）→ `confirmSubmit` + 启动 reviewer
- 撤回（reviewing 状态 + 倒计时未到）→ `withdrawSubmission` + `cancelScheduledVotes`
- 状态特定显示（已提交链接 / 撤回倒计时 / CV 入账金额）

⏳ 沿用旧版逻辑（Wave 2.5.A.3+ 重写）：
- ❌ 审核员投票动画（仅静态显示 N/3 进度）
- ❌ 申诉流（仅 chip 显示 "申诉处理中"）
- ❌ CV 入账动画（仅静态金额）
- ❌ 撤回 1s tick 实时刷新（依赖 React HMR · 状态变化时刷新）

### 文件清单
```
🆕 src/lib/questDefinitions.ts          (5 任务数组 · 抽自旧 QuestLog)
🆕 src/hooks/useQuestStates.ts
🆕 src/components/QuestCard.tsx
🆕 src/components/SubmissionForm.tsx
🆕 src/components/NewQuestLog.tsx
🔄 src/hooks/index.ts (加 export)
```

---

## 安装

```powershell
cd D:\projects\cua-base

$zip = "C:\Users\ghani\Downloads\cua-spike-wave2-5a2.zip"
Test-Path $zip

tar -xf $zip
Copy-Item -Path .\cua-spike-wave2-5a2\* -Destination . -Recurse -Force
Remove-Item -Path .\cua-spike-wave2-5a2 -Recurse -Force

# 验证
Test-Path src\lib\questDefinitions.ts
Test-Path src\hooks\useQuestStates.ts
Test-Path src\components\QuestCard.tsx
Test-Path src\components\SubmissionForm.tsx
Test-Path src\components\NewQuestLog.tsx
```

期望 5 个 `True`。

---

## 必须手动改 src/App.tsx · 替换 QuestLog

```powershell
cd D:\projects\cua-base

Copy-Item src\App.tsx D:\projects\backup-cua\App.tsx.before-wave2-5a2 -ErrorAction SilentlyContinue

$content = [System.IO.File]::ReadAllText("$PWD\src\App.tsx", [System.Text.UTF8Encoding]::new($false))

# 加 import
$oldImport = "import { NewAnnouncementPanel } from './components/NewAnnouncementPanel';"
$newImport = "import { NewAnnouncementPanel } from './components/NewAnnouncementPanel';`r`nimport { NewQuestLog } from './components/NewQuestLog';"
$content = $content.Replace($oldImport, $newImport)

# 替换 <QuestLog /> → <NewQuestLog />
$content = $content -replace '<QuestLog />', '<NewQuestLog />'

# 同时移除桥接器（NewQuestLog 自己监听 toggle-panel 了）
$content = $content -replace '\s*<PanelToggleBridge />', ''

[System.IO.File]::WriteAllText("$PWD\src\App.tsx", $content, [System.Text.UTF8Encoding]::new($false))

# 验证
Write-Host "=== imports ==="
Select-String -Path src\App.tsx -Pattern "from './components/NewQuestLog'" | Format-Table LineNumber, Line

Write-Host "=== 应只有 NewQuestLog · 0 个 QuestLog ==="
Select-String -Path src\App.tsx -Pattern '<QuestLog />|<NewQuestLog />' | Format-Table LineNumber, Line

Write-Host "=== PanelToggleBridge 应已移除 ==="
Select-String -Path src\App.tsx -Pattern '<PanelToggleBridge />' | Format-Table LineNumber, Line
```

---

## 跑

```powershell
pnpm dev
```

打开 `http://localhost:5173/play` 登录进游戏。

按 **J 键** → 像素风任务日志（540×600）

或点 NewGameAppHUD 左下 📋 任务图标。

---

## 测试清单

```
☐ 1. J 键打开 → 像素风任务日志（540×600）
☐ 2. 看到 4 tab：可接 / 进行中 / 审核中 / 已完成
☐ 3. 默认在 "可接" tab · 看到 5 任务（百晓居）
☐ 4. 点任务卡 → 展开详情（描述 + 质量评分 + 验收标准）
☐ 5. 点 "接受" 按钮 → 任务移到 "进行中" tab
☐ 6. 进行中 tab 看到任务 · 点 "提交作品"
☐ 7. 提交表单：URL 输入 + x0.5/x1.0/x2.0 自评 + 评分细则
☐ 8. 输入 https://example.com → 显示 "占位链接不能用于真实提交"
☐ 9. 输入有效 https://github.com/xxx/yyy → 点 "确认提交"
☐ 10. 任务移到 "审核中" tab
☐ 11. 看到提交链接 + 自评 chip + "可撤回 N s" 倒计时（3 分钟内）
☐ 12. 3 分钟内点 "撤回" → 任务回到 "进行中"（草稿保留）
☐ 13. 等审核员投票 → 静态进度 N/3
☐ 14. 完成后 → 任务移到 "已完成" tab + CV 入账金额显示
☐ 15. ESC 关闭面板
☐ 16. ESC 在提交表单里 → 先关表单 · 再按一次关面板
☐ 17. 点 NewGameAppHUD 左下 📋 → 切换面板
☐ 18. 点 NewGameAppHUD 左下 📜 公告 → 公告板（不冲突）
```

### 兼容性检查
```
☐ 旧 QuestLog 文件保留（src/components/QuestLog.tsx 还在 · Wave 2.6 删）
☐ Chat（T）/ Mail（K）/ Friends（F）/ Profile（P）/ Announcement（点 5 图标 📜）仍能开
☐ 教程 / 节气 banner / 通知 toast 仍正常
☐ Phaser 多人在场仍正常
☐ ReviewProcessor / AppealProcessor headless 组件仍正常监听
☐ CV 入账时 cv-updated EventBus 触发 · NewGameAppHUD 左上 CVBar 实时刷新
```

---

## ⚠️ 已知限制（Wave 2.5.A.2 · 故意）

- ⚠️ **撤回倒计时不实时**：状态变化时才刷新（旧版有 1s tick）· 影响小
- ⚠️ **审核进度静态**：N/3 只显示 · 没有动画
- ⚠️ **申诉无法操作**：appealing 状态显示但没有按钮（沿用旧版需进 ReviewPanel）
- ⚠️ **CV 入账无动画**：直接显示金额（CVBar 会有金光动画）

---

## ⚠️ 紧急回滚

```powershell
Copy-Item D:\projects\backup-cua\App.tsx.before-wave2-5a2 src\App.tsx
```

---

## Push

```powershell
git add .
git commit -m "Wave 2.5.A.2: NewQuestLog 80% pixel rewrite

- Extracted QUESTS array to src/lib/questDefinitions.ts
- New pixel quest log (540x600) with 4 status tabs
- QuestCard component with foldable details
- SubmissionForm: URL + self-rate + reviewer scheduling
- Withdraw button (3min window) + cancelScheduledVotes
- Real-time questStore subscription via useSyncExternalStore
- Old QuestLog preserved (1052 lines, Wave 2.6 cleanup)
- Removed PanelToggleBridge (NewQuestLog handles toggle-panel directly)"

git push
```

---

## 下一波

Wave 2.5.A 系列基本完成（公告板 + QuestLog 80% 视觉）。

回我**一个**：

- **"完成 · 进 Wave 2.5.A.3"** = 审核员投票流像素化（3-4h）
- **"完成 · 进 Wave 2.5.B"** = 议政 3 panel（4-5h）
- **"完成 · 进 Wave 2.5.C"** = 远见塔/功德堂/路线图（3-4h）
- **"完成 · 进 Wave 2.6 收尾"** = 删旧组件 + 清理（2-3h）
- **"完成 · 暂停找用户测"**
- **"调整某处"** + 写出
