# Wave 5.A.1 · 萌芽镇 · 设计稿照搬 + NPC 散布重定位

UI 重构第 5 波 · 第 1 步 — **新 sproutown.json + 5 NPC 重定位**

---

## ⚠️ 这是破坏性改动 · 必须仔细读

跟 Wave 1-4 不同 · 本波**改了游戏功能层**：
- 替换 `sproutown.json` · 新 tilemap（设计稿照搬）
- 移动 5 NPC 坐标
- 移动 3 个门触发器
- **删除铁匠铺内景入口**（玩家不能进铁匠铺了 · 只能在外面对话铁匠老周）
- **删除玩家"自家"入口**（C10 home door · 设计稿没空间）

后续 Wave 5.A.2 / 5.A.3 才会做完整测试 + 教程指引修复。

---

## 这一波做了什么

### 1. 新 sproutown.json · 完全照搬设计稿

设计稿 `SPROUTOWN_MAP` 是 24×14 字符串：

```
GGGGGGGGGGGGGGGGGGGGGGGG     ← 行 0 全草
GGTTTGGGGGGGGGGGGGGTTTGG     ← 行 1: 左 3 树 + 右 3 树
GGGGGGGPPPPPPPPGGGGGGGGG     ← 行 2: 上方屋外圈路
GGGGGGGPHHHHHHPGGGTTGGGG     ← 行 3: 屋顶（金黄）
GGTGGGGPHWWWWHPGGGGGGGGG     ← 行 4: 屋墙 + 内装饰水
GGGGGGGPHHDHHHPGGGGGGGGG     ← 行 5: 门（D 在 col 10）
GGGGGGGPPPPPPPPGGGGGGGGG     ← 行 6: 屋外圈路
GGGGRRRRRRRRRRRRRRRGGGGG     ← 行 7: 横贯石板路
GGGGGGGGGGGGGGGGGGGGTTGG     ← 行 8: 右侧 2 树
GGGGGGGPPPPPPPPGGGGGGGGG     ← 行 9: 下方屋外圈路
GGTGGGGPSSSSSSPGGGGGGGTG     ← 行 10: 屋顶（石板色）
GGGGGGGPSDSSSSPGGGGGGGTG     ← 行 11: 门（D 在 col 9）
GGGGGGGPPPPPPPPGGGGGGGGG     ← 行 12: 屋外圈路
GGGGGGGGGGGGGGGGGGGGGGGG     ← 行 13 全草
```

**居中放在 30×20 grid**（OFF_X=3, OFF_Y=3）→ 兼容现有 tileset (32×32 px tile)

### 2. 5 NPC 散布（方案 1）

| NPC | 旧 tile | 新 tile | 备注 |
|---|---|---|---|
| 阿降 | (13, 6) | **(13, 9)** | 上方屋门正下方 |
| 蓁（图书管理员）| (21, 6) | **(16, 8)** | 上方屋门右侧 |
| 老周（铁匠）| (5, 15) | **(16, 12)** | 横贯路下方 · 路边铁匠摊（无屋）|
| 阿满（商人）| (15, 14) | **(21, 10)** | 横贯石板路右端 |
| 默（钓鱼老人）| (24, 17) | **(26, 16)** | 右下空地 |
| 司影（魔镜匠）| (10, 14) | **(4, 12)** | 左下空地 |

### 3. 3 个门触发器重定位

| 门 | 旧 tile | 新 tile |
|---|---|---|
| 阿降小屋 | (13, 5) | **(13, 8)** |
| 典籍阁 | (21, 5) | **(12, 14)** |
| 共创之都港口 | (1, 10) | **(28, 18)** |

### 4. 移除的功能

- **铁匠铺内景入口** · 老周变成"路边对话 NPC"（不进屋）
- **玩家自家"回家"门**（C10 home door）· 设计稿没空间

### 5. 告示板坐标 · (11, 11) → (15, 11)

---

## 文件清单

```
🆕 public/assets/maps/sproutown.json   (新 tilemap · 设计稿照搬)
🔄 src/game/scenes/MainScene.ts        (NPC 坐标 + 门坐标 + 删 BLACKSMITH/enterHome)
```

---

## 安装

```powershell
cd D:\projects\cua-base

$zip = "C:\Users\ghani\Downloads\cua-spike-wave5a1.zip"
Test-Path $zip

# 备份现有 sproutown.json + MainScene.ts
mkdir -p D:\projects\backup-cua\wave5a1
Copy-Item public\assets\maps\sproutown.json D:\projects\backup-cua\wave5a1\sproutown.json.bak -Force
Copy-Item src\game\scenes\MainScene.ts D:\projects\backup-cua\wave5a1\MainScene.ts.bak -Force

tar -xf $zip
Copy-Item -Path .\cua-spike-wave5a1\* -Destination . -Recurse -Force
Remove-Item -Path .\cua-spike-wave5a1 -Recurse -Force

# 验证
Test-Path public\assets\maps\sproutown.json
Test-Path src\game\scenes\MainScene.ts
```

期望 2 个 `True`。

---

## ⚠️ 必须重启 dev server（改了 Phaser 资源）

```powershell
# Ctrl+C 杀掉 pnpm dev
pnpm dev
```

⚠️ **强烈建议浏览器开 F12 + 硬刷新**（Ctrl+Shift+R）· 否则 Phaser 缓存旧 JSON。

---

## 测试清单

```
☐ 1. 打开 /play · 看到萌芽镇新地图（设计稿布局）
☐ 2. 上方屋（阿降小屋）金顶 · 屋内有蓝色装饰水
☐ 3. 下方屋（典籍阁）灰顶（石板）
☐ 4. 横贯石板路 row 10 (像素 y=336)
☐ 5. 6 NPC 都看得到 · 阿降在上方屋门下 / 蓁在阿降右侧 / 老周在路下 / 阿满在路右 / 默在右下 / 司影在左下
☐ 6. 走到上方屋门口 (13,8) · 提示 "[E] 进入阿降的小屋" · 按 E 进屋 OK
☐ 7. 走到下方屋门口 (12,14) · 提示 "[E] 进入典籍阁" · 按 E 进屋 OK
☐ 8. 走到地图右下 (28,18) · 提示 "[E] 前往共创之都" · 按 E 跳场景 OK
☐ 9. 接近铁匠老周 · 按 E 对话（不进屋 · 直接路边对话）OK
☐ 10. 5 新手任务 · 阿降首次对话开始 · OK
☐ 11. 4 errand 任务（找蓁/老周/阿满/默）· 全可触发对话 OK
☐ 12. 告示板 (15, 11) · 接近 + E 显示告示
☐ 13. 3 朵花散布（左上 / 右上 / 右中）· 玩家走过去自动收集
☐ 14. 教程指引 · 仍说"走到老村长身边"（位置变了但描述对）
```

---

## ⚠️ 已知问题（留给后续 Wave）

### 1. 铁匠铺内景没了
- 现状：玩家无法进铁匠铺看到老周打铁场景
- 影响：blacksmith 任务可能不能正常进行（如果任务依赖进屋）
- ⚠️ 测试时关注 · 可能需要 Wave 5.A.2 修复

### 2. 玩家"回家"功能没了
- 现状：玩家不能按 E 回家（HomeScene）
- 影响：HomeScene 仍存在但访问不到
- ⚠️ 如果你之前用过这个 · 现在不能用了

### 3. 教程引导文案没改
- `tutorialSteps.ts` 仍说"走到老村长阿降身边"
- 实际位置变了 · 但教程描述还能用（不需要改）

### 4. 道路网络问题
- 设计稿只有 row 10 的横贯石板路
- 玩家想从一栋屋走到另一栋 · 必须**先回到石板路**
- 可能感觉绕路

### 5. 萌芽镇范围变小
- 实际可玩区域局限在 24×14（720×448 像素）
- 周围 3 行 / 3 列是空草地
- 可能感觉地图大但内容少

---

## ⚠️ 紧急回滚

```powershell
Copy-Item D:\projects\backup-cua\wave5a1\sproutown.json.bak public\assets\maps\sproutown.json
Copy-Item D:\projects\backup-cua\wave5a1\MainScene.ts.bak src\game\scenes\MainScene.ts
```

---

## Push

```powershell
git add .
git commit -m "Wave 5.A.1: Sproutown design-aligned tilemap + NPC repositioning

New sproutown.json (24x14 design map centered in 30x20 grid):
- 2 cottages: upper (gold roof) + lower (stone roof)
- Stone road row 10 (横贯)
- 5 trees scattered, 1 decorative water tile

NPC repositioning (Plan 1: distributed):
- Axiang: tile (13,9) - upper cottage door
- Librarian: tile (16,8) - right of upper cottage
- Blacksmith: tile (16,12) - roadside stall (no enterable forge)
- Merchant: tile (21,10) - east end of stone road
- Fisher: tile (26,16) - bottom-right
- Mirror: tile (4,12) - bottom-left

Door triggers repositioned:
- Axiang cottage: (13,8)
- Librarian library: (12,14) - now lower cottage
- Sprout City port: (28,18) - moved from west to east

Removed:
- BLACKSMITH_FORGE_CONFIG (no enterable forge in design)
- enterHome / Player home door (no space in design)

Wave 5.A.2 next: tutorialSteps update + full quest flow testing
Wave 5.A.3 next: bug fixes + polish"

git push
```

---

## 下一步

回我**一个**：

- **"看到了 · 装好了 · push + 进 Wave 5.A.2 (教程修复 + 测试)"**
- **"装上有问题 X"** + 描述 + F12 截图
- **"白屏 / 黑屏"** + F12 截图（可能 Phaser tilemap 加载失败）
- **"回滚 · 不喜欢"** = 跑紧急回滚命令
- **"暂停 · 找用户测"** ✅ 我推荐
