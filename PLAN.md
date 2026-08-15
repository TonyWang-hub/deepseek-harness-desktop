# DeepSeek Harness Desktop — 可执行方案

一句话：**Electron 薄壳 + pinned 官方 dsh 载荷，零 fork，纵切当天可跑。**

## 已定决策（不再讨论，除非证据推翻）

| 决策 | 内容 | 依据 |
|---|---|---|
| D1 壳 | **Electron** | ①产品承诺"100% 官方浏览器体验"→ Chromium 与 web 应用逐像素同源；②Host 需要 Node → Electron 自带运行时，sidecar 打包问题消失；③"无需安装 Node" 零成本满足 |
| D2 载荷 | **pinned 官方 `@deepseek-ai/dsh`（npm 依赖）**，永不修改、永不 fork | 升级 = 改一个版本号；与上游完全解耦 |
| D3 数据 | 复用标准 `$DSH_HOME`（profile/凭据/会话原样可用） | 老用户零迁移 |
| D4 传输 | HTTP/WS over `127.0.0.1:<随机端口>`，上游浏览器信任栅栏原样生效 | UDS/本机进程认证是上游挂账项，首发不做 |
| D5 退役 | 双候选 bake-off、16-WP 治理流程 | 社区 8 个壳 + 本团队 harness 实测已回答实验问题；Tauri 留作 V2 内存优化的 challenger |

从旧规划回收的三项资产已并入本方案：官方载荷不可修改原则（D2）、宿主监督者需求（v0.1 验收 3/4/5）、fixture 对等回放（→ v0.3 CI 门）。

## v0.1 纵切（已完成）

```text
src/main.js     Electron 主进程：
                spawn(ELECTRON_RUN_AS_NODE → node_modules/@deepseek-ai/dsh, web --port 0)
                → 解析就绪行 "dsh web: http://127.0.0.1:<port>"
                → BrowserWindow.loadURL；就绪前显示启动页
                → 生命周期：全窗关闭→SIGTERM 宿主(超时 SIGKILL)；宿主意外退出→提示+指数退避重启；单实例锁
                → --smoke：无头验收模式（就绪+页面加载完成即打印 SMOKE OK 退出 0）
package.json    electron + @deepseek-ai/dsh（版本钉死）
```

### 验收（全部可执行）

1. `npm start` → 窗口出现 → 官方 Web UI 完整可用（建会话、流式、工具、审批）
2. `npm run smoke` → 退出码 0（宿主就绪 + 页面加载完成的自动化证明）
3. 退出应用 → `pgrep -f "dsh.*web"` 无残留
4. `kill -9 <host pid>` → 应用提示并自动重启宿主，窗口恢复可用
5. 二次启动 → 聚焦既有窗口而非新实例

### 已知风险与兜底

- **原生模块 ABI**：dsh 依赖若含 native addon，Electron 的 Node ABI 可能不匹配 → 兜底：`DSH_DESKTOP_NODE=<path>` 环境变量切换到外部 Node 运行宿主（smoke 会立即暴露此问题）
- 就绪行格式变更（上游升级时）→ smoke 失败即报警，改一行解析

## v0.2 打包（发布候选已完成）

- 版本为 `0.2.0`：Electron `43.4.0` + 未修改的 `@deepseek-ai/dsh@0.1.0-rc.6` + 内置 `pnpm@11.21.0`。
- arm64/x64 按架构独立干净安装与打包；每次构建自动验收完整 production tree、干净 `$DSH_HOME` smoke、pnpm、ripgrep、Sharp、Koffi、node-pty 和真实 PTY。
- Host 正常退出等待 SIGTERM→SIGKILL；桌面主进程崩溃时，fd3 生存期通道保证 Host 不变成孤儿进程。
- 窗口禁止非本地导航、新窗口与非必要权限；自动更新不阻塞启动，下载失败可控。
- 应用使用独立设计的极简黑白图标，不使用或改造 DeepSeek 官方鱼形标识；SVG、1024 px PNG、ICNS、App 和 DMG 图标均有可执行验收。
- 正式构建强制校验签名、Gatekeeper 和 stapled notarization ticket；只有显式 `HARNESS_DESKTOP_ALLOW_UNSIGNED=1` 才能生成本地测试包。
- GitHub Actions 已将 arm64/x64 分别放在原生 macOS runner 上构建，通过签名、公证、挂载 smoke 和产物摘要校验后，先生成 draft，再原子发布精确 10 个 Release 资产。

### 2026-08-15 实测结果

- GitHub Linux CI 在串行准备 Electron runtime、保留 Chromium sandbox 并通过 Xvfb 运行真实 Electron 后，源码测试 `38/38` 通过；官方 npm registry audit 为 `0` 漏洞。
- 当前 arm64 产物 packaged acceptance `4/4` 通过（含 App/DMG 图标）；x64 隔离干净安装的 production runtime acceptance `3/3` 通过。两架构 DMG/ZIP 完整性、Mach-O 架构、挂载 DMG 后冷启动 smoke、端口释放与无残留进程均通过。正式 Release 仍会从同一 tag 对两架构重新执行完整验收。
- `dist/latest-mac.yml` 已合并两架构 ZIP/DMG，并逐件校验文件大小与 SHA-512。

### 正式发布前置

- Developer ID Application 证书已安装并在本机验证可用；尚需安全导出并将其与 App Store Connect notarization API 凭据存入受保护的 `release` Environment。当前候选包仍是功能验收用 unsigned 产物，不冒充正式签名包。
- `TonyWang-hub/deepseek-harness-desktop` 已完成公开仓库的中英文社区文件、Issue/PR 模板、Discussions、Dependabot、CodeQL、私密漏洞报告、Actions 权限收紧、CI 与双架构 Release workflow。`v0.2.0` 草稿 Release 已预建，正式 tag 刻意保持不存在，直到签名与公证凭据齐备。
- 首个正式 Release 会同时上传两架构 DMG/ZIP 及各自 blockmap、唯一 `latest-mac.yml` 和 `SHA256SUMS.txt`；此前不上传 unsigned 候选包。第二个稳定版发布前再完成一次旧版→新版真实自动更新验收。

## 路线图

采用“先稳定跨平台体验核心，再逐个平台发布”的顺序；非 macOS 平台不得削弱 D2（官方载荷不可修改）、标准 `$DSH_HOME`、宿主无孤儿进程和正式产物 fail-closed 验收。

### v0.2 — macOS 正式发布

代码、原创图标、双架构 unsigned 候选、GitHub CI/Release 自动化与中英文发布说明已完成；签名、公证与首个 GitHub Release 由独立发布任务等待上述 Apple 凭据，不阻塞后续版本开发。

### v0.3 — 桌面体验与跨平台基础（已完成）

版本为 `0.3.0`；继续使用 Electron `43.4.0`、未修改的 `@deepseek-ai/dsh@0.1.0-rc.6` 和内置 `pnpm@11.21.0`。

- **托盘驻留**：关闭窗口只隐藏窗口，Host 与会话继续运行；托盘菜单提供“打开”和明确的“退出”，退出仍须等待 Host 完整终止。
- **Dock 菜单**：仅在 macOS 提供“打开”和“退出”，保持单实例、单窗口模型，不引入第二套 UI。
- **崩溃恢复**：Host 偶发退出继续自动恢复；短时间连续失败达到阈值后停止重启循环，页面只显示脱敏故障信息，并提供手动重试与退出。
- **fixture 行为对等 CI 门**：固定工作区与外部插件 fixture，分别经官方浏览器入口和桌面入口回放会话流、工具调用、审批与错误事件；归一化非确定字段后事件结果必须一致，不做易受上游 UI 变化影响的逐像素截图。
- **平台边界**：将运行时启动器、Host 终止、托盘/Dock、产物定位和 packaged acceptance 分成平台无关核心与平台适配层；现有 macOS 行为和验收不得回退。

验收：`npm test`、`npm run smoke`、macOS packaged acceptance 全部通过；关闭窗口后可由托盘恢复，选择退出后端口释放且无残留 Host；连续崩溃进入可手动恢复的停止态；fixture 两入口回放结果一致。

#### 2026-08-15 实测结果

- 完整源码测试 `66/66` 通过；真实 Electron 验收关闭窗口后确认同一 Host/端口继续可用、由实际 Tray click listener 恢复同一 `BrowserWindow`，三次真实 Host 崩溃进入停止态，手动 Retry 恢复，明确 Quit 后精确 Host PID 与端口均消失。spawn `error`/`exit` 只计一次失败。
- `npm run test:fixture-parity` `1/1` 通过：两个隔离 `$DSH_HOME` 分别经官方直连浏览器入口和桌面监督入口加载真实 Host；严格轨迹保留完整工具参数/结果/错误、call ID、审批、step、compaction、用户/助手消息和最终回复，对未知事件 fail closed，并结构化归一化 Windows JSON 路径。
- `npm run smoke` 通过并释放随机端口；arm64 unsigned `0.3.0` App/DMG packaged acceptance `6/6` 通过，新增非 smoke 托盘驻留、同一窗口恢复和精确 Host 清理验收；正式 Release workflow 会在原生 arm64/x64 runner 上从同一 tag 重新执行签名、公证、staple、产物与更新元数据验收。
- Linux CI 已加入独立 fixture parity 步骤，使用同一固定插件与工作区，不需要模型凭据，也不修改官方载荷。

### v0.4 — Windows x64

- 在原生 Windows x64 runner 上执行独立干净安装，提供 Windows runtime/pnpm 启动器和可靠的 Host 进程树终止。
- 使用 electron-builder 生成 x64 NSIS 安装包及自动更新所需产物；加入 Windows 图标、`latest.yml`、校验清单和独立 Release 构建任务。
- Windows 正式产物必须代码签名并通过安装、卸载、冷启动、单实例、托盘、崩溃恢复、旧版→新版自动更新验收；无签名凭据时仅允许通过显式开关生成本地测试包，不得发布为正式版本。
- packaged acceptance 必须执行官方 Host、pnpm、ripgrep、Sharp、Koffi、`node-pty` 和真实 Windows PTY，并证明应用退出或桌面主进程崩溃后端口释放且无残留进程。

验收：Windows x64 源码测试、fixture 对等回放、安装包完整性、签名检查、安装后 smoke、production runtime acceptance、进程清理和真实自动更新全部通过，Release 才可公开。

### v0.5 — Linux x64

在 Windows 路线稳定后增加 Linux x64 原生构建，优先 AppImage；复用 v0.3 平台边界和 fixture CI 门，并补齐桌面文件、图标、托盘兼容、沙箱、进程树清理、打包 smoke、更新元数据与校验清单。是否同时提供 deb 由真实分发需求决定。

### 后置评估

- **Windows arm64**：仅在用户需求明确且官方载荷的完整原生依赖可在 Windows arm64 验收通过后加入。
- **Tauri challenger（v0.6+）**：仅当实测内存数据构成用户问题时启动对比（回收旧规划的评测框架思路），不因跨平台目标提前 fork 官方载荷或更换已验证的 Electron 主路线。
