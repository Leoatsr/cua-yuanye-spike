# Wave 4.B · Phaser 跨路由切场景

UI 重构第 4 波 · 第 2 步 — **/play?scene=XXX 自动切到目标 scene**

---

## 这一波做了什么

✅ **BootScene 升级**为路由调度器：
- 解析 URL `?scene=XXX` query string
- 白名单验证（Main / SproutCity / GovHill / GrandPlaza）
- 清掉 query string（防止刷新重复触发）
- 切到目标 scene · 否则默认 Main

✅ 文件清单
```
🔄 src/game/scenes/BootScene.ts    (~120 行 · 加了 resolveTargetScene + clearQueryString)
```

---

## 工作量惊喜

⚠️ **本波比预期简单** — 实际工作量 **1h** vs 预估 2-3h。

原因：BootScene 本来就是 Phaser 入口 · 只需在 `create()` 加 query 解析 + 调度即可 · 不需要复杂的"等 Phaser ready"逻辑。

---

## 实现原理

```
用户在 /maps 点击 "进入 议政高地"
  ↓
navigate('/play?scene=GovHill')
  ↓
React Router 渲染 MainGameApp
  ↓
Phaser 实例创建 · 自动启动 BootScene
  ↓
BootScene.preload() 加载所有资源
  ↓
BootScene.create() 检查 URL query string
  ↓
找到 ?scene=GovHill · 验证合法
  ↓
clearQueryString() · URL 变回 /play
  ↓
this.scene.start('GovHill') · 直接进议政高地 ✓
```

---

## 安装

```powershell
cd D:\projects\cua-base

$zip = "C:\Users\ghani\Downloads\cua-spike-wave4b.zip"
Test-Path $zip

tar -xf $zip
Copy-Item -Path .\cua-spike-wave4b\* -Destination . -Recurse -Force
Remove-Item -Path .\cua-spike-wave4b -Recurse -Force

# 验证
Test-Path src\game\scenes\BootScene.ts
```

期望 1 个 `True`。

---

## ✅ 不需要改 App.tsx

BootScene.ts 直接覆盖旧版 · 接口不变 · 路由不动。

---

## 跑

```powershell
pnpm dev
```

⚠️ **重要** · 改了 Phaser 内部 · 可能需要重启 dev server：

```powershell
# Ctrl+C 杀掉 pnpm dev · 然后重新跑
pnpm dev
```

---

## 测试清单 · 5 个场景

### 测试 1 · /maps 跳转 → 议政高地

```
☐ 1. 打开 http://localhost:5173/maps
☐ 2. 点击 议政高地 location · 单击选中 · 详情面板显示
☐ 3. 点击 "进入 议政高地 ▶" 按钮（或双击 location）
☐ 4. 浏览器跳转 /play?scene=GovHill
☐ 5. Phaser 加载完成（看 F12 Console 进度日志）
☐ 6. ⭐ 直接进入议政高地（不是默认萌芽镇）
☐ 7. URL 变回 /play（query 已清）
☐ 8. F12 Console 看到 "[BootScene] Routing to scene from URL: GovHill"
```

### 测试 2 · /maps 跳转 → 共创之都

```
☐ 9. /maps 双击 共创之都 → /play?scene=SproutCity
☐ 10. 直接进入共创之都场景
☐ 11. 看到 9 工坊外景 + 喷泉广场
```

### 测试 3 · 直接打开 /play（无 query）

```
☐ 12. 打开 http://localhost:5173/play
☐ 13. 默认进入萌芽镇（Main 场景）
☐ 14. F12 Console 不打印路由日志（query 为空）
```

### 测试 4 · 非法 scene key

```
☐ 15. 打开 http://localhost:5173/play?scene=NotARealScene
☐ 16. F12 Console 警告 "Invalid scene key"
☐ 17. 默认回到 Main 场景
☐ 18. URL 自动变回 /play
```

### 测试 5 · 刷新不重复跳转

```
☐ 19. /maps → 进入议政高地后
☐ 20. 议政高地里按 F5 刷新
☐ 21. 还是停在议政高地（因为 URL 已是 /play 而非 /play?scene=GovHill）
☐ 22. 没看到 BootScene 日志再次打印
```

### 测试 6 · 大集会广场（敬请期待）

```
☐ 23. /maps 双击 大集会广场（available=false）
☐ 24. ⚠️ 不跳转（MapsPage handleEnter 已检查 available）
☐ 25. 详情面板显示 "此区域暂未开放"
```

---

## ⚠️ 已知限制

- ⚠️ **大集会广场（GrandPlaza）虽在白名单 · 但 MapsPage 阻止跳转**：因为 location.available=false。如果想测试 GrandPlaza scene 可以手动改 URL：`http://localhost:5173/play?scene=GrandPlaza`
- ⚠️ **未登录跳转**：如果用户未登录 · 跳 /play 会先看 TitleScreen · 登录后才进游戏。此时 query 在 URL 里 · BootScene 仍能正常解析（query 不会丢失）
- ⚠️ **scene 加载顺序**：BootScene 先 preload 所有资源（~1-3s）· 然后才 start。如果资源加载失败 · 会卡在加载界面（这是 Phaser 行为 · 跟 Wave 4.B 无关）

---

## ⚠️ 紧急回滚

如果出现问题 · git 已备份：

```powershell
git checkout src/game/scenes/BootScene.ts
```

---

## Push

```powershell
git add .
git commit -m "Wave 4.B: cross-route scene switching via query string

BootScene upgraded to route dispatcher:
- Parses ?scene=XXX query string in create()
- Whitelist validation: Main / SproutCity / GovHill / GrandPlaza
- Falls back to Main if invalid or missing
- clearQueryString() via history.replaceState (no React rerender)
- Logs routing decisions to console

Flow:
  /maps click 'enter GovHill' -> navigate('/play?scene=GovHill')
  -> React Router renders MainGameApp
  -> Phaser instance creates, BootScene preloads
  -> BootScene.create() reads URL query
  -> scene.start('GovHill') directly

No App.tsx changes required.
Wave 4 100% complete · entire UI redesign 95% done"

git push
```

---

## 🎉 Wave 4 全部完成 · 整个 UI 重构 95% 完成

```
✅ Wave 1 · Design System + 共享 UI 组件 + LandingPage
✅ Wave 2 · 16 面板像素化（Chat/Mail/Friends/QuestLog/议政/远见塔/功德堂/自家小屋）
✅ Wave 2.5.A.3 · QuestLog Q2/Q3/Q4 动画
✅ Wave 2.5.A.4 · QuestLog Q1 审核员投票完整动画
✅ Wave 2.6.B · README + docs + 博客
✅ Wave 3.A · ManualPage 完整版 6 tab
✅ Wave 3.B · CodexPage 完整版 6 tab
✅ Wave 4.A · MapsPage 大地图 + minimap
✅ Wave 4.B · 跨路由切场景 ← 这次

剩余 5%：
⏳ 找用户测 + 反馈
⏳ Wave 5+ · 真任务源（GitHub Issues 同步）
⏳ Wave 5+ · 多人在场（Phaser Realtime）
```

## 下一步 · 强烈建议

回我**一个**：

- **"全好 · push + 暂停找用户测"** ✅ **强推**
- **"全好 · push + 进 Wave 5（真任务源）"** = 大功能 · 8-12h 跨多波
- **"全好 · push + merge 到 main + 部署生产"**
- **"X 有问题"** + 描述
