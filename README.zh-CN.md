# DeepSeek Harness Desktop

[English](README.md) | 简体中文

[![CI](https://github.com/TonyWang-hub/deepseek-harness-desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/TonyWang-hub/deepseek-harness-desktop/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

<p align="center"><img src="build/icon-1024.png" width="128" alt="DeepSeek Harness Desktop 极简黑白终端环图标"></p>

这是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的非官方 macOS 桌面外壳。它在 Electron 中运行锁定版本且未修改的官方 `@deepseek-ai/dsh` Web 应用，并保留标准 `$DSH_HOME`，因此桌面应用与 `dsh` 共享 profile、凭据、会话、工具和插件。

> **发布状态——v0.4.4 是当前最新的已签名、公证 macOS 正式版本。** 仅从本仓库的[最新发布](https://github.com/TonyWang-hub/deepseek-harness-desktop/releases/latest)下载，选择原生架构，并验证发布校验和与 Apple 签名。本地生成的 unsigned 候选包仍仅用于测试，不得作为正式发布包转发。
>
> **证明状态：进行中。** 严格的公开 v0.4.1→v0.4.2 升级证明失败，原因是旧应用在 proxy 传输完成、原生 Squirrel staging 尚未 ready 时就过早暴露更新。v0.4.3 会等待 Electron 原生 `update-downloaded` 信号后才启用退出安装；v0.4.4 是载荷不变的公开证明目标。在真实 v0.4.3→v0.4.4 验收完成前仍不声称自动安装可用。v0.4.2 或更早版本的来源应用无法可靠地自动获得修复，必须手动安装匹配架构的 v0.4.4 DMG。

## 为什么选择这套实现

社区桌面客户端已经支持更多平台、定制化初始配置，以及更小的 Tauri 或 WebView 外壳。本项目有意将范围收窄到以下特性：

- **无上游 fork 或补丁层。** 载荷是锁定版本的原始 npm 发布包，当前为 `@deepseek-ai/dsh@0.1.0-rc.6`。升级时修改依赖版本和 lockfile，而不是将桌面改动重新合并到上游 UI 代码。
- **共用一个数据主目录。** 外壳不替换 `$DSH_HOME`；CLI 和桌面应用无需导入或迁移即可看到同一份 Harness 状态。
- **首次启动不下载运行时。** Node.js、`pnpm@11.21.0`、官方 production 依赖树、ripgrep 和分架构原生模块均内置于应用。模型和 Web provider 调用仍可能需要网络；“离线载荷”不等于离线模型推理。
- **常驻桌面工作流。** 关闭窗口后，单一 Host 与会话保持运行；可通过托盘和 macOS Dock 菜单恢复同一窗口或明确退出。
- **完整管理进程生命周期。** 应用等待 Host 就绪；短时间连续崩溃达到有限重试阈值后停止循环并提供手动恢复页；正常退出时执行 TERM→KILL，并为 Host 提供父进程生存期管道，避免桌面主进程崩溃后留下孤儿进程。
- **唤醒可靠性。** 单一桌面状态机统一管理启动、就绪、离线等待、恢复、断路、更新就绪和退出。macOS resume/解锁时，Host 健康则只重载页面；离线不会计入崩溃次数；本地 Host 不可达时只创建一个受控替代进程。
- **私密诊断。** 托盘和 Dock 菜单中的 **Export Diagnostics… / 导出诊断…** 会生成仅所有者可读（`0600`）的 allowlist JSON 自检报告。它只记录版本、桌面/Host 状态、更新状态和内置运行时检查，不采集会话、Host 日志、环境变量值、凭据、`$DSH_HOME` 或个人路径。
- **行为与真实产物验收。** CI 通过直接浏览器入口与桌面入口回放包含工具、审批和错误的确定性外部插件会话。arm64 和 x64 构建还会在通过前执行已打包的 Host、官方插件命令、内置 Node 和 pnpm launcher、ripgrep、Sharp、Koffi、`node-pty` 以及真实 PTY。

这会减少上游适配工作，但不会让本外壳变成官方产品，也不保证未来的每个 Harness 版本都无需调整打包代码。

## 架构

```text
DeepSeek Harness Desktop (Electron main)
├─ desktop state + wake/network recovery controller
├─ Host supervisor and parent-lifetime pipe
│  └─ bundled Node → host bootstrap → @deepseek-ai/dsh web --port 0
├─ allowlisted private diagnostics export
├─ app-local bin/node and bin/pnpm for Host tools and child processes
└─ sandboxed BrowserWindow → http://127.0.0.1:<random-port>
                               └─ official Harness Web UI

standard $DSH_HOME ← shared by the desktop app and dsh CLI
```

Electron 只负责原生窗口、进程监督、打包和更新集成；Harness 负责界面和 Agent 行为。Host 监听操作系统分配的回环端口；窗口阻止其他 origin，拒绝新窗口，并且只向可信的本地 origin 授予经净化的剪贴板写入权限。

应用使用 Electron 内置的 Node 运行 Host，并在 Harness 或其子命令运行前清除 Electron 专用的进程标记。`DSH_DESKTOP_NODE=/absolute/path/to/node` 保留为上游原生运行时不兼容时的高级备用方案。

## 下载与安装

### 发布可用性

[最新发布 v0.4.4](https://github.com/TonyWang-hub/deepseek-harness-desktop/releases/tag/v0.4.4)提供已签名、公证并 stapled 的 macOS arm64/x64 产物、校验和与更新元数据。它是用于公开验证 v0.4.3 原生 readiness 修复的载荷不变后继版本；证明仍在进行，因此尚不声称自动安装可用。v0.4.2 或更早版本请手动安装匹配架构的 DMG。名称相近的其他仓库会发布独立社区构建，它们的代码、数据路径、更新策略和签名状态并不相同。

### 选择 Apple Silicon 或 Intel

打开 **Apple 菜单 → 关于本机**，检查处理器或芯片：

| Mac | 架构 | 发布后的预期 DMG 名称 |
| --- | --- | --- |
| Apple M 系列芯片 | `arm64` | `DeepSeek-Harness-Desktop-<version>-mac-arm64.dmg` |
| Intel 处理器 | `x64` | `DeepSeek-Harness-Desktop-<version>-mac-x64.dmg` |

DMG 与 Mac 架构匹配时无需 Rosetta。请勿在 Intel Mac 上安装 arm64 构建，也不要默认在 Apple Silicon 上使用 x64 构建。

### 安装已签名构建

1. 从本项目的[最新发布](https://github.com/TonyWang-hub/deepseek-harness-desktop/releases/latest)下载匹配的 DMG。
2. 将其 SHA-256 与 `SHA256SUMS.txt` 比对；始终验证已安装应用的 Apple 签名。
3. 打开 DMG，将 **DeepSeek Harness Desktop** 拖入 **Applications**。
4. 从 Applications 启动应用。如果被标为官方发布的构建出现“无法验证开发者”警告，应停止安装并验证来源，而不是绕过 Gatekeeper。

## 验证发布包

### SHA-256

每个发布都会在 `SHA256SUMS.txt` 中提供权威 SHA-256 值。对已下载的匹配文件执行以下命令，并比对全部 64 个十六进制字符：

```sh
shasum -a 256 ~/Downloads/DeepSeek-Harness-Desktop-<version>-mac-arm64.dmg
shasum -a 256 ~/Downloads/DeepSeek-Harness-Desktop-<version>-mac-x64.dmg
```

只需使用与已下载架构匹配的一行。自动更新器会另行使用 `latest-mac.yml` 中的 SHA-512 值；两个架构的 manifest 合并前，这些值会从每个更新产物生成并与产物重新校验。

### Apple 签名与公证

将应用复制到 `/Applications` 后，macOS 可以验证正式构建所强制的同样三项属性：

```sh
codesign --verify --deep --strict --verbose=2 "/Applications/DeepSeek Harness Desktop.app"
spctl --assess --type execute --verbose=4 "/Applications/DeepSeek Harness Desktop.app"
xcrun stapler validate "/Applications/DeepSeek Harness Desktop.app"
```

所有命令都必须成功退出。Gatekeeper 应报告已接受的 Developer ID 应用，`stapler` 应报告有效 ticket。任一检查失败或跳过公证都会使构建失败。只有 `HARNESS_DESKTOP_ALLOW_UNSIGNED=1` 会为本地测试构建关闭这些检查，该模式还会关闭签名身份自动发现，避免产生误导性的局部签名。

## 自动更新

公开 GitHub Release feed 提供双架构更新元数据。已打包的 production 应用会在启动后执行一次非阻塞检查。如果存在更新，应用会等待下载完成，然后通知用户在应用退出时安装；网络或 feed 错误会被报告，但不会阻塞 Harness 启动。

正式签名 v0.4.1→公开 v0.4.2 的真实证明显示，electron-updater 的 proxy 传输 promise 早于原生 Squirrel 可安装事件完成。应用过早暴露 `updating`，因此明确 Quit 在 staging ready 前进入安装器，最终安全回退后仍安装 v0.4.1。v0.4.3 会在检查前注册原生观察器，同时要求 proxy 传输与原生 `update-downloaded` 完成，再执行 Host 精确关闭及原有 `quitAndInstall()` / `before-quit-for-update` 握手。v0.4.4 不修改 updater 代码，仅用于公开验证该修复路径。从 v0.4.2 或更早版本升级时请手动安装 v0.4.4 DMG；v0.4.3→v0.4.4 证明正在进行，成功前仍不声称自动安装可用。源码构建和 smoke 模式不检查更新。

只有合并后的 `latest-mac.yml`、arm64 和 x64 ZIP/DMG 及 blockmap 一同通过精确资产、校验和、签名、公证、staple、packaged acceptance 与挂载 DMG 门后，Release feed 才会发布。

## v0.4.0 Mac Reliability

已签名、公证的 v0.4.0 在两个 Mac 原生架构中均包含以下行为：

- macOS resume 或解锁后，如果回环 Host 健康，则保持精确 PID 与端口，只在同一个 BrowserWindow 中重载页面连接。
- macOS 报告离线时，桌面端等待并重试，不重启 Host，也不增加三次失败断路器的计数。
- 设备在线但当前回环 Host 不可达时，桌面端会有意替换该精确 Host，并验证只剩一个替代进程。Generation 检查会阻止延迟 probe 或页面加载覆盖新 Host 状态。
- 通过托盘或 Dock 菜单的 **Export Diagnostics… / 导出诊断…** 保存 allowlist 自检报告。JSON 在写入内容前即设为仅所有者可读；提交 Issue 前仍应自行检查。报告不会包含会话、原始 Host 输出、环境变量值、凭据或私有路径。

## 从源码构建与验证

### 开发

前置条件：macOS，以及当前架构的 Node.js `24.17.x`。

```sh
npm ci
npm run smoke
npm start
```

`npm run smoke` 会在随机回环端口上启动真实官方 Host，加载其 Web UI，并等待 Host 干净退出。

### 本地 unsigned 包

Unsigned 包仅用于本地验收：

```sh
HARNESS_DESKTOP_ALLOW_UNSIGNED=1 npm run dist:mac:arm64
HARNESS_DESKTOP_ALLOW_UNSIGNED=1 npm run dist:mac:x64
```

只运行与当前 Node 进程和干净依赖安装架构匹配的命令。如果架构不匹配或缺少目标架构原生包，构建会失败；然后它会自动运行打包产物验收。请勿发布、转发或将这些产物宣传为可信下载。

### 打包产物验收

每个架构构建都会验证：

- 每个已安装的 production 包都作为物理文件存在于打包产物中；
- 干净 `$DSH_HOME` 可以冷启动官方 Host 和 Web UI，并在退出时释放回环端口；
- 官方插件命令可以找到内置 pnpm，而子进程看到的是内置 Node，而不是 Electron GUI 模式；
- ripgrep、Sharp、Koffi、`node-pty` 和真实 shell PTY 可以从打包应用中执行；
- 健康 resume、离线等待和主动替换不健康 Host 会保持同一窗口、维持正确崩溃计数，并且只留下一个 Host；
- 实际导出的诊断文件权限为 `0600`，且不包含注入 secret 或私有路径；以及
- 应用具有所需 Mach-O 架构，正常退出或父进程死亡后不会留下 Host 进程。

发布验收证据和跨平台路线图见 [PLAN.md](PLAN.md)。

## 社区参与

- 提交 PR 前请阅读 [Contributing](CONTRIBUTING.md)。
- 使用 [Discussions](https://github.com/TonyWang-hub/deepseek-harness-desktop/discussions) 提问或寻求安装帮助。
- 可复现缺陷和桌面端功能建议请使用结构化 Issue 表单。
- 请遵守 [Security](SECURITY.md)、[Support](SUPPORT.md) 和 [Code of Conduct](CODE_OF_CONDUCT.md) 政策。

## 社区项目对比

快照日期：2026-08-15。下表比较的是范围，不是排名；这些早期项目变化很快，请以链接仓库为准。

| 项目 | 已发布桌面产物 | 载荷与数据 | 更新 | 签名与公证证据 |
| --- | --- | --- | --- | --- |
| 本项目 | [v0.4.4](https://github.com/TonyWang-hub/deepseek-harness-desktop/releases/tag/v0.4.4)：macOS arm64/x64 DMG 与 ZIP、更新元数据和校验和 | 锁定且未修改的 npm 载荷；标准 `$DSH_HOME`；内置 runtime；唤醒恢复与私密诊断 | 已包含原生 readiness 修复；公开 v0.4.3→v0.4.4 证明进行中，v0.4.2 及更早版本仍需手动 DMG | Release workflow 验证 `codesign`、Gatekeeper、stapled 公证 ticket、packaged acceptance 与挂载 DMG |
| [anywhere-labs/deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) | [v0.1.0](https://github.com/anywhere-labs/deepseek-harness-desktop/releases/tag/v0.1.0)：macOS arm64 和 Windows x64 | 完整 Harness 源码树内的 Electron 桌面应用；打包 workspace 依赖；托盘集成 | 当前[桌面 manifest](https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/apps/desktop/package.json) 未声明 updater | v0.1.0 未记录产物信任状态；当前源码包含独立的 [macOS 发布预检](https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/apps/desktop/scripts/release-preflight.ts) |
| [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop) | [v0.1.7](https://github.com/dataelement/dsh-desktop/releases/tag/v0.1.7)：macOS arm64/x64 和 Windows x64，含更新元数据 | 锁定 rc.6 包，并使用有文档记录的 [`patch-package` overlays](https://github.com/dataelement/dsh-desktop/tree/main/patches) 增加桌面功能；应用专用 Harness 数据目录 | [Electron updater](https://github.com/dataelement/dsh-desktop/blob/main/src/main/update/update-manager.ts) 检查已安装的 macOS 和 Windows 构建 | [发布工作流](https://github.com/dataelement/dsh-desktop/blob/main/.github/workflows/release.yml) 在 macOS 上验证 `codesign`、Gatekeeper 和 `stapler`；其 [manifest](https://github.com/dataelement/dsh-desktop/blob/main/package.json) 关闭了 Windows 更新代码签名验证 |
| [steven-kid/deepseek-harness-desktop](https://github.com/steven-kid/deepseek-harness-desktop) | [v0.3.4](https://github.com/steven-kid/deepseek-harness-desktop/releases/tag/v0.3.4)：macOS arm64/x64、Windows x64 和 Linux x64 | Electron、锁定的官方 rc.6 UI、标准 Harness 数据和托盘集成 | 其 [README](https://github.com/steven-kid/deepseek-harness-desktop#known-limitations) 说明尚未集成自动更新 | 同一 README 说明 macOS 未通过 Apple 公证，Windows 未进行商业代码签名 |
| [hairyf/deepseek-harness-desktop](https://github.com/hairyf/deepseek-harness-desktop) | [v0.1.9](https://github.com/hairyf/deepseek-harness-desktop/releases/tag/v0.1.9)：macOS arm64/x64、Windows x64 和 Linux x64 | Tauri 控制外壳；首次启动下载预构建 Harness bundle；应用专用 `$DSH_HOME` | 独立于桌面应用检查和替换 Harness bundle | 其[发布工作流](https://github.com/hairyf/deepseek-harness-desktop/blob/main/.github/workflows/release.yml) 配置 Tauri updater 密钥，但未配置 Apple Developer 签名或公证凭据 |
| [xiincs/deepseek-harness-desktop](https://github.com/xiincs/deepseek-harness-desktop) | [v1.0.0](https://github.com/xiincs/deepseek-harness-desktop/releases/tag/v1.0.0)：macOS arm64、Windows x64 和 Linux x64 | 内置 Node/DSH 且使用标准 `~/.dsh` 的 Tauri 外壳 | Windows 配置了签名的 Tauri updater 产物；macOS/Linux 仅下载 | 其 [README](https://github.com/xiincs/deepseek-harness-desktop#deepseek-harness-desktop-tauri) 明确标注 macOS/Linux 构建未签名、未公证 |

如果优先需要 Windows/Linux 支持、定制 provider 初始配置、preset 迁移或最小外壳，可选择其他社区客户端。如果相比这些附加功能，更看重与上游精确一致的行为、常驻托盘工作流、共享 CLI 状态、首启不下载运行时、深入的打包运行时验收和失败封闭的 macOS 发布策略，则本项目更合适。

## 上游关系、许可证与商标

本仓库是独立桌面外壳，不是 DeepSeek 产品。未修改的载荷文件来自 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)，并保留上游许可证和 notice。外壳源码按 [MIT License](LICENSE) 提供；内置第三方依赖仍适用各自许可证。

“DeepSeek”、“DeepSeek Harness”、相关标识以及其他商标归各自权利人所有。本项目使用这些名称只为说明兼容性和上游来源，不表示关联、赞助、认证或背书。
