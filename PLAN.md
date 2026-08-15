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
- 正式构建强制校验签名、Gatekeeper 和 stapled notarization ticket；只有显式 `HARNESS_DESKTOP_ALLOW_UNSIGNED=1` 才能生成本地测试包。

### 2026-08-15 实测结果

- 源码测试 `28/28` 通过，npm audit `0` 漏洞。
- arm64 与 x64 的 packaged acceptance 各 `3/3` 通过；两架构 DMG/ZIP 完整性、Mach-O 架构、挂载 DMG 后冷启动 smoke、端口释放与无残留进程均通过。
- `dist/latest-mac.yml` 已合并两架构 ZIP/DMG，并逐件校验文件大小与 SHA-512。

### 正式发布前置

- 需要 Developer ID Application 证书和 Apple notarization 凭据；当前候选包是功能验收用 unsigned 产物，不冒充正式签名包。
- 需要创建 `TonyWang-hub/deepseek-harness-desktop` 公开仓库和 GitHub Release，上传合并后的 `latest-mac.yml`、两架构 ZIP/DMG 及 blockmap，再做一次旧版→新版真实更新。完成前，自动更新客户端已实现，但 feed 尚不存在。

## 路线图

- **v0.2 打包**：代码与双架构 unsigned 候选已完成；签名/公证和 GitHub Release 等待上述外部凭据与仓库
- **v0.3 体验**：托盘、Dock 菜单、崩溃恢复打磨、fixture 对等回放进 CI（回收资产③）
- **v0.4 评估**：仅当内存数据构成用户问题时，启动 Tauri challenger 对比（回收旧规划的评测框架思路）
