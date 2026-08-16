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

### 正式发布基础（已完成）

- Developer ID Application 证书和 App Store Connect notarization API 凭据已存入受保护的 `release` Environment；Release workflow 对未签名、未通过 Gatekeeper 或缺少 stapled ticket 的产物 fail closed。
- [`v0.2.0`](https://github.com/TonyWang-hub/deepseek-harness-desktop/releases/tag/v0.2.0) 已正式发布：arm64/x64 DMG/ZIP、各自 blockmap、唯一 `latest-mac.yml` 和 `SHA256SUMS.txt` 共十项产物均公开；下载后的 arm64 DMG 已再次验证为 `Notarized Developer ID` 且 ticket 有效。
- `TonyWang-hub/deepseek-harness-desktop` 已完成中英文社区文件、Issue/PR 模板、Discussions、Dependabot、CodeQL、私密漏洞报告、Actions 权限收紧、CI 与双架构 Release workflow。后续稳定版继续从同一 tag 原生构建、签名、公证并验证全部产物。

## 路线图

采用“先稳定跨平台体验核心，再逐个平台发布”的顺序；非 macOS 平台不得削弱 D2（官方载荷不可修改）、标准 `$DSH_HOME`、宿主无孤儿进程和正式产物 fail-closed 验收。

### v0.2 — macOS 正式发布

代码、原创图标、双架构候选、GitHub CI/Release 自动化与中英文发布说明已完成；`v0.2.0` 已由受保护 Release workflow 原生构建 arm64/x64，完成 Developer ID 签名、Apple 公证、staple、产物校验并正式发布。

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
- `npm run smoke` 通过并释放随机端口；arm64 unsigned `0.3.0` App/DMG packaged acceptance `6/6` 通过，新增非 smoke 托盘驻留、同一窗口恢复和精确 Host 清理验收。
- [`v0.3.0`](https://github.com/TonyWang-hub/deepseek-harness-desktop/releases/tag/v0.3.0) 已由受保护 Release workflow 在原生 arm64/x64 runner 完成 fixture parity、Developer ID 签名、Apple 公证、staple、packaged acceptance 与精确十项资产发布；正式 tag 指向 `aae80007938fca48432951ce8f57c6c45a104284`。
- Linux CI 已加入独立 fixture parity 步骤，使用同一固定插件与工作区，不需要模型凭据，也不修改官方载荷。

### v0.4 — macOS Reliability

版本为 `0.4.0`。用户选择先深化 macOS，再继续 Windows；该阶段保持单实例、单窗口、官方载荷零修改和标准 `$DSH_HOME`，只增强桌面壳拥有的可靠性边界。

- **统一状态机**：以 `starting`、`ready`、`disconnected`、`recovering`、`circuit-open`、`updating`、`quitting` 表达唯一桌面状态；Host、窗口、Tray/Dock、恢复页和更新器不得各自维护冲突判断。
- **睡眠/唤醒与网络恢复**：macOS resume/unlock 后先检查网络与 Host 健康。Host 可达时仅重新加载页面连接；离线时等待网络恢复且不计入崩溃断路器；在线但本地 Host 不可达时才受控重启 Host。
- **自检与脱敏诊断包**：输出应用/系统/架构/官方载荷版本、Host 状态、更新状态和 bundled runtime 检查；绝不写入会话正文、Token/Cookie/Authorization、真实主目录或 `$DSH_HOME` 路径。Tray 提供显式导出动作。

验收：纯状态转换与恢复决策单测通过；真实 Electron 验证 Host 健康时 resume 只重载同一窗口且 PID/端口不变、离线不重启、不增加 crash count、Host 不健康时只启动一个替代 Host；诊断包通过敏感值对抗测试；`npm test`、fixture parity、smoke 与 arm64 packaged acceptance 全部通过后才可进入发布准备。

#### 2026-08-16 实现与验收记录

- 单一状态机已接入 Host 启动、崩溃断路器、手动恢复、网络断开、更新就绪和退出；更新下载状态可跨 wake 恢复，Host readiness 支持跨输出 chunk 并拒绝旧进程异步结果。
- macOS resume/unlock 分层恢复已通过真实 Electron 与 packaged 验收：健康 Host 只重载同一窗口，离线保持精确 PID/URL 且 crash count 为 0，不健康 Host 只产生一个替代 PID，旧 PID 与端口被回收。
- Tray/Dock 已加入诊断导出；报告只含 allowlist 字段，真实导出文件在写入内容前即设为 `0600`，源码与 packaged 对抗测试均证明不包含 `$DSH_HOME`、socket 路径或注入 secret。
- 最终证据：macOS 源码 `89 passed / 1 Windows-only skip`、fixture parity `1/1`、source smoke 通过、unsigned arm64 packaged acceptance `6/6`；Linux/Windows CI 在 [run 31926953834](https://github.com/TonyWang-hub/deepseek-harness-desktop/actions/runs/31926953834) 全绿，独立复审结论 `READY`。本记录不代表已签名发布 v0.4.0，版本号、正式双架构签名/公证与 Release 仍属于后续发布准备。

### v0.5 — Windows x64

- 在原生 Windows x64 runner 上执行独立干净安装，提供 Windows runtime/pnpm 启动器和可靠的 Host 进程树终止。
- 使用 electron-builder 生成 x64 NSIS 安装包及自动更新所需产物；加入 Windows 图标、`latest.yml`、校验清单和独立 Release 构建任务。
- Windows 正式产物必须代码签名并通过安装、卸载、冷启动、单实例、托盘、崩溃恢复、旧版→新版自动更新验收；无签名凭据时仅允许通过显式开关生成本地测试包，不得发布为正式版本。
- packaged acceptance 必须执行官方 Host、pnpm、ripgrep、Sharp、Koffi、`node-pty` 和真实 Windows PTY，并证明应用退出或桌面主进程崩溃后端口释放且无残留进程。

验收：Windows x64 源码测试、fixture 对等回放、安装包完整性、签名检查、安装后 smoke、production runtime acceptance、进程清理和真实自动更新全部通过，Release 才可公开。

#### 已完成的前置验证切片

- 显式退出路径已接入 Windows `taskkill /T` 进程树终止：先尝试非强制关闭，失败或超时后使用 `/F`，并等待根 Host 退出和 taskkill 命令完成后才报告清理完成。
- 原生 `windows-2025` x64 CI 已执行真实根进程加后代进程验收并通过；同一提交的 Linux 完整源码与 fixture parity 门也通过（[run 31906814786](https://github.com/TonyWang-hub/deepseek-harness-desktop/actions/runs/31906814786)）。
- Windows runtime/pnpm 原生 launcher、桌面主进程崩溃后的整树清理、NSIS 打包、签名、packaged runtime 与更新验收仍待后续完成。

### v0.6 — Linux x64

在 Windows 路线稳定后增加 Linux x64 原生构建，优先 AppImage；复用 v0.3 平台边界和 fixture CI 门，并补齐桌面文件、图标、托盘兼容、沙箱、进程树清理、打包 smoke、更新元数据与校验清单。是否同时提供 deb 由真实分发需求决定。

### 后置评估

- **Windows arm64**：仅在用户需求明确且官方载荷的完整原生依赖可在 Windows arm64 验收通过后加入。
- **Tauri challenger（v0.7+）**：仅当实测内存数据构成用户问题时启动对比（回收旧规划的评测框架思路），不因跨平台目标提前 fork 官方载荷或更换已验证的 Electron 主路线。
