# AGENTS.md — 执行守则（Codex 必读）

本仓库的方案已定型：读 [PLAN.md](PLAN.md)，它是唯一的规划文件。你的工作是**执行**，不是规划。

## 铁律

1. **禁止引入任何流程/治理框架**（spec-kitty、mission、work package、lane、charter 等一律禁止）。本仓库曾因此消耗 6 小时零产出，全部制品已在 `2cdac26` 退役。
2. **禁止新建规划文档**。不写 spec.md、research.md、tasks.md、roadmap 等；PLAN.md 需要修订时直接改它，一次提交。
3. **完成的定义 = PLAN.md 的验收命令通过**，不是文档完备、不是评审流转。每个改动落地后立刻跑对应验收命令并在提交信息里写实际结果。
4. **官方载荷不可修改**：`@deepseek-ai/dsh` 只允许改版本号。任何"需要 patch 上游"的念头 = 方案错了，停下来在 PLAN.md 的风险表加一行，交人决策。
5. **小步提交**：一个提交解决一件事，带可执行的验证证据。禁止囤积大分支。
6. 提交身份用仓库已配置的 `TonyWang-hub`（已设好，勿动 git config）。

## 当前状态与下一步

- `src/main.js` 是完整的 v0.1 纵切（宿主监督 + 窗口 + smoke 模式），验收状态见最新提交信息。
- 你的队列 = PLAN.md「v0.1 验收」未勾项，然后按顺序进 v0.2（electron-builder 打包 dmg、签名公证、载荷随包、自动更新）。
- 遇到原生模块 ABI 报错：先用 `DSH_DESKTOP_NODE=$(which node) npm run smoke` 复测定界，把结论写进 PLAN.md 风险表再动手。

## 验证命令速查

```sh
npm run smoke        # 无头验收：宿主就绪+页面加载 ⇒ exit 0
npm start            # 人工验收：完整 Web UI 可用
pgrep -f "dsh.*web"  # 退出后必须为空（无孤儿宿主）
```
