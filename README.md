# Wave 2.3.A · ChatPanel 像素风重写（世界频道）

UI 重构第 2 波 · 第 3 步 — **新像素聊天面板上线**

---

## 这一波做了什么

| 类型 | 文件 | 作用 |
|---|---|---|
| 🆕 hook | `src/hooks/useChatMessages.ts` | 监听 `chat-message-received` |
| 🆕 hook | `src/hooks/useToggleViaEventBus.ts` | 通用 panel toggle |
| 🆕 component | `src/components/ChatMessageItem.tsx` | 单条消息渲染 |
| 🆕 component | `src/components/NewChatPanel.tsx` | 主聊天面板 |
| 🔄 hook | `src/hooks/index.ts` | 加 export |

✅ Wave 2.3.A 范围：
- 像素古籍风视觉（380×520，右下浮动）
- 世界频道完整功能（消息列表 + 发送 + 实时接收）
- 5s 反 spam 倒计时 UI
- 200 字符上限 + 字符计数
- 消息时间戳格式化（刚刚 / N 分前 / HH:MM / 昨天 HH:MM / MM-DD）
- 头像渲染（GitHub avatar_url 或 fallback Sprite）
- 滚动到底逻辑
- T 键 + 'toggle-panel' EventBus 双触发
- ESC 关闭
- 自己消息 vs 别人消息视觉区分

⏳ Wave 2.3.B 将做：场景频道 / 私聊 / 用户名搜索

---

## 安装

```powershell
cd D:\projects\cua-base

$zip = "C:\Users\ghani\Downloads\cua-spike-wave2-3a.zip"
Test-Path $zip

tar -xf $zip
Copy-Item -Path .\cua-spike-wave2-3a\* -Destination . -Recurse -Force
Remove-Item -Path .\cua-spike-wave2-3a -Recurse -Force

# 验证
Test-Path src\hooks\useChatMessages.ts
Test-Path src\components\NewChatPanel.tsx
```

期望 2 个 `True`。

---

## 必须手动改 src/App.tsx · 替换 ChatPanel

### Step 1 · 加 import

```powershell
cd D:\projects\cua-base

Copy-Item src\App.tsx D:\projects\backup-cua\App.tsx.before-wave2-3a -ErrorAction SilentlyContinue

$content = [System.IO.File]::ReadAllText("$PWD\src\App.tsx", [System.Text.UTF8Encoding]::new($false))

# 加 NewChatPanel import (在 NewGameAppHUD import 后)
$oldImport = "import { NewGameAppHUD } from './pages/NewGameAppHUD';"
$newImport = "import { NewGameAppHUD } from './pages/NewGameAppHUD';`r`nimport { NewChatPanel } from './components/NewChatPanel';"
$content = $content.Replace($oldImport, $newImport)

[System.IO.File]::WriteAllText("$PWD\src\App.tsx", $content, [System.Text.UTF8Encoding]::new($false))

# 验证
Select-String -Path src\App.tsx -Pattern "NewChatPanel" | Format-Table LineNumber, Line
```

期望看到：
```
LineNumber Line
---------- ----
        84 import { NewChatPanel } from './components/NewChatPanel';
```

### Step 2 · 替换 `<ChatPanel />` 为 `<NewChatPanel />`

```powershell
cd D:\projects\cua-base

$content = [System.IO.File]::ReadAllText("$PWD\src\App.tsx", [System.Text.UTF8Encoding]::new($false))

# 替换 <ChatPanel /> 为 <NewChatPanel />
$content = $content -replace '<ChatPanel />', '<NewChatPanel />'

[System.IO.File]::WriteAllText("$PWD\src\App.tsx", $content, [System.Text.UTF8Encoding]::new($false))

# 验证
Write-Host "=== 应该 0 个 <ChatPanel /> ==="
Select-String -Path src\App.tsx -Pattern '<ChatPanel />' | Format-Table LineNumber, Line

Write-Host ""
Write-Host "=== 应该 1 个 <NewChatPanel /> ==="
Select-String -Path src\App.tsx -Pattern '<NewChatPanel />' | Format-Table LineNumber, Line
```

期望：
- 第一段 0 行（旧的删干净）
- 第二段 1 行 `<NewChatPanel />`

⚠️ **保留** `<ChatPanelKeyListener />` —— 它仍然能用（emit `toggle-chat-panel` EventBus，新 NewChatPanel 监听这个事件）。

---

## 测试

```powershell
pnpm dev
```

打开 `http://localhost:5173/play` → 登录进游戏。

### 测试清单

```
☐ 1. 按 T 键 → 新像素聊天面板出现（右下角浮动 · 380×520）
☐ 2. 看到 "聊天 · 世界频道" 标题 + 消息计数 chip
☐ 3. 看到 3 个 tab：世界（激活）/ 场景（灰）/ 私聊（灰）
☐ 4. 点 ✕ 按钮关闭
☐ 5. 按 Esc 关闭
☐ 6. 重新按 T 打开 · 输入框自动 focus
☐ 7. 输入消息 · 看到字符计数 0/200
☐ 8. 字符接近 170 → 计数变金色（警告色）
☐ 9. 超过 200 → 红色 + 发送按钮 disabled
☐ 10. 按 Enter 发送 → 消息出现在列表 + 输入框清空 + "冷却中 5s..." 显示
☐ 11. 5s 内试发 → 输入框 disabled
☐ 12. 5s 后 → 重新可发送
☐ 13. 收到别人消息 → 自动滚动到底
☐ 14. 自己消息 → 名字金色 + "· 你" 标识 + 浅色背景
☐ 15. 别人消息 → 名字咖啡色 + 透明背景
☐ 16. 头像渲染 GitHub avatar 或 fallback sprite
☐ 17. 时间戳：刚发 → "刚刚" · 5 分前 → "5 分前" · 1h 前 → HH:MM
☐ 18. 点新像素 HUD 左下 💬 聊天图标 → 切换面板
```

### 兼容性检查

```
☐ 旧 T 键仍能用（ChatPanelKeyListener 不变）
☐ 旧 ChatPanel 文件保留（src/components/ChatPanel.tsx 还在）
☐ 其他 panel（QuestLog J / MailBox K / FriendsPanel F / ProfilePanel P）仍能开
☐ 教程 + 节气 banner + 通知 toast 仍正常
☐ Phaser 游戏 + 多人在场仍正常
```

---

## ⚠️ 已知限制（Wave 2.3.A · 故意）

- ⚠️ **没初始历史消息** — App.tsx 启动时 `subscribeWorld()` 已调用，但只接收实时消息，没有 `loadRecentHistory` 调用展示之前 50 条历史
- ⚠️ **场景频道 tab 灰** — Wave 2.3.B 接通
- ⚠️ **私聊 tab 灰** — Wave 2.3.B 接通
- ⚠️ **没 G2-D 用户名搜索** — Wave 2.3.B 加
- ⚠️ **5 图标按钮 toggle-panel 已通** — 点 NewGameAppHUD 左下 💬 触发的就是这个面板

---

## ⚠️ 紧急回滚

如果坏了：

```powershell
Copy-Item D:\projects\backup-cua\App.tsx.before-wave2-3a src\App.tsx
pnpm dev
```

---

## Push

跑通后：

```powershell
git add .
git commit -m "Wave 2.3.A: NewChatPanel pixel rewrite (world channel)

- New pixel-style ChatPanel (380x520, bottom-right floating)
- 5s cooldown UI + 200 char limit
- Time formatting (just now / N min ago / HH:MM / yesterday HH:MM)
- Avatar rendering (GitHub avatar_url or fallback Sprite)
- 'toggle-chat-panel' + 'toggle-panel' EventBus dual triggers
- Esc to close
- Self vs others visual distinction
- Scene/Private channels grayed out (Wave 2.3.B coming)"

git push
```

---

## 下一波 · Wave 2.3.B

回我 "完成 Wave 2.3.A · 进 2.3.B" 我立刻做：
- 场景频道接通
- 私聊 conversation 列表
- 用户名搜索
- recipient 切换
- ~~3-4h 工作量~~

或者：

- "Wave 2.3.A 跑通后 → 直接进 Wave 2.4（MailBox + FriendsPanel）"
- "暂停 · 用户测一段时间"

回一句话即可。
