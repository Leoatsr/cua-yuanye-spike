# CUA 源野物语 · Day 3 · 公测版

把当前的萌芽镇升级成**对外可发布**的版本：

- 🆕 **标题屏 / 启动画面** —— 进游戏先看到「源野物语」logo + 一句话项目介绍
- 🆕 **任务清单** —— 右上角浮窗，引导玩家见到所有 5 个 NPC + 告示板
- 🆕 **完成横幅** —— 6 项全完成后温和祝贺 + 进度记忆（用 localStorage）
- 🆕 **音乐启动逻辑改良** —— 标题屏关闭瞬间音乐自动响起（不再需要"按任意键开始播放"提示）

---

## 第 1 步：本地验证（先确认改动 OK）

下载 `cua-spike-day3.zip`，**保留目录结构**解压。

把 zip 里的 `cua-spike-day3` 文件夹**内的内容**合并到：

```
D:\projects\cua-yuanye-spike\
```

变更的文件：

- 新增 `src/components/TitleScreen.tsx`
- 新增 `src/components/QuestPanel.tsx`
- 覆盖 `src/App.tsx`
- 覆盖 `src/game/entities/NPC.ts`（加 questId）
- 覆盖 `src/game/entities/SignPost.ts`（加 questId）
- 覆盖 `src/game/scenes/MainScene.ts`（NPC 配上 questId、BGM 逻辑改良）

跑：

```powershell
cd D:\projects\cua-yuanye-spike
pnpm dev
```

浏览器 **Ctrl + F5**。你应该看到：

1. 黑色启动画面，显示「源野物语 · SOURCE · VALLEY」+ "按任意键进入"
2. 按任意键 → 标题屏渐隐 → 进入萌芽镇 + 音乐响起
3. 右上角出现任务清单：6 项任务，0/6
4. 跟阿降对话 → "与老村长阿降交谈" 变绿打勾，1/6
5. ...拜访所有 NPC + 看告示板 → 6/6
6. 屏幕中央弹出"萌芽镇探索完成"祝贺横幅

确认这些都正常后，进入**部署阶段**。

---

## 第 2 步：推到 GitHub

你已经有仓库地址：`https://github.com/Leoatsr/cua-yuanye-spike`

如果项目还没初始化 git：

```powershell
cd D:\projects\cua-yuanye-spike
git init
git add .
git commit -m "Day 3: title screen + quest panel"
git branch -M main
git remote add origin https://github.com/Leoatsr/cua-yuanye-spike.git
git push -u origin main
```

如果已经初始化过：

```powershell
cd D:\projects\cua-yuanye-spike
git add .
git commit -m "Day 3: title screen + quest panel"
git push
```

> **重要：** 提交前先看一眼 `.gitignore`，确保 `node_modules/` 和 `dist/` 在里面（不要把这些大文件夹提交到 GitHub）。
> Vite 模板自动生成的 `.gitignore` 已经处理好了，正常情况无需操心。

---

## 第 3 步：部署到 Vercel

### 1. 注册 / 登录 Vercel

打开 https://vercel.com，用你的 GitHub 账号登录（一键授权）。

### 2. 导入项目

1. 点 **Add New** → **Project**
2. 在 GitHub 仓库列表里找到 `cua-yuanye-spike` → 点 **Import**
3. 配置页面：
   - **Project Name**：建议改成 `cua-yuanye`（这会决定你的链接 `cua-yuanye.vercel.app`）
   - **Framework Preset**：Vite（应该自动检测到）
   - **Build Command**：`pnpm build`（保持默认）
   - **Output Directory**：`dist`（保持默认）
   - **Install Command**：`pnpm install`（保持默认）
4. 点 **Deploy**

等 1-2 分钟。完成后会显示一个 `xxx.vercel.app` 的链接——**就这个链接发给社区**。

### 3. 验证部署

打开 `https://cua-yuanye.vercel.app`（你的具体链接），确认：

- 标题屏正常显示
- 按任意键进入游戏
- 角色能动、NPC 能对话、任务清单能打勾
- 音乐能响（注意：Vercel 是 HTTPS，浏览器自动播放策略一致，不会有问题）

---

## 第 4 步：发飞书群（v0.1 公测）

> 🎉 各位昨天看了 GIF 想体验的朋友们：来玩吧
>
> https://cua-yuanye.vercel.app
>
> 萌芽镇 v0.1 公测版上线。预计 5 分钟探索完——右上角任务清单引导你逛遍 5 个 NPC + 1 个告示板。
>
> 玩完后真心想听这几个问题：
> 1. 哪个 NPC 让你印象最深？
> 2. 走完一圈，你觉得 CUA 社区做成这样的"游戏化协作"靠不靠谱？
> 3. 想看到的下一个工坊是哪个？典籍阁？铁匠铺？还是别的？
>
> 提醒：如果国内访问慢，可能需要稍等加载，或者用 VPN。后续会处理国内可访问性。

---

## 国内访问问题

**Vercel 在中国大陆的访问质量参差不齐**——有时候很快、有时候打不开。这是已知问题，跟你做花信风时遇到的一样。

**短期方案：** 在飞书群配文里说一句"国内可能需要 VPN 或稍等加载"。
**中期方案：** 也部署一份到 [腾讯 EdgeOne Pages](https://edgeone.cloud.tencent.com/pages)（国内可访问，但需要做实名认证）。
**长期方案：** ICP 备案 + 国内云部署（你应该熟悉这套流程）。

**我的建议：先用 Vercel 让 50 个想玩的人能玩**——他们里多数是 CUA 核心用户，有 VPN 不是问题。**优先验证产品方向，国内访问问题等下一波再解决**。

---

## 调试常用命令

如果部署出问题：

```powershell
# 本地预览（模拟生产环境）
pnpm build
pnpm preview
```

如果 Vercel 部署日志里报错（点 deployment 进去看 logs），把日志截图发我。

---

## 跑通后告诉我

部署成功后告诉我链接，我可以一起：
- 帮你看部署是否一切正常
- 起草更精致的飞书群配文
- 规划接下来的 Phase 1 任务

——也可以**就到这里**，让飞书群好好玩两天，等真实玩家反馈再决定下一步。这同样是好选择。
