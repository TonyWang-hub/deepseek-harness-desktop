# Contributing / 贡献指南

[English](#english) | [简体中文](#简体中文)

## English

Thank you for improving DeepSeek Harness Desktop. This repository owns the desktop shell, packaging, lifecycle supervision, and release automation. It embeds the pinned, unmodified `@deepseek-ai/dsh` payload.

### Before opening work

- Use [Discussions](https://github.com/TonyWang-hub/deepseek-harness-desktop/discussions) for questions and setup help.
- Use the issue forms for reproducible desktop bugs and feature requests.
- Report vulnerabilities through [private vulnerability reporting](https://github.com/TonyWang-hub/deepseek-harness-desktop/security/advisories/new), never a public issue.
- If the behavior also occurs in the official `dsh web` profile, report it to the upstream DeepSeek Harness project.

### Local development

Use Node.js 24.17.0 on macOS, then run:

```sh
npm ci --registry=https://registry.npmjs.org
npm test
npm run smoke
```

Keep changes focused. Do not patch, vendor, or rewrite the official DSH payload. Never commit credentials, `$DSH_HOME`, build output, signing assets, or notarization keys. Add or update executable tests for behavior changes and update both languages when changing user documentation.

### Pull requests

Open an issue first for substantial behavior or architecture changes. In the pull request, explain the user-visible outcome, list the exact verification commands you ran, and call out packaging, lifecycle, updater, security, or compatibility risk. The `main` branch requires CI before merge.

## 简体中文

感谢改进 DeepSeek Harness Desktop。本仓库只负责桌面壳、打包、进程生命周期和发布自动化；内置的 `@deepseek-ai/dsh` 官方载荷必须精确锁定且不做修改。

### 开始之前

- 使用 [Discussions](https://github.com/TonyWang-hub/deepseek-harness-desktop/discussions) 提问或寻求安装帮助。
- 可复现的桌面端问题和功能建议请使用 Issue 表单。
- 安全漏洞必须通过 [私密漏洞报告](https://github.com/TonyWang-hub/deepseek-harness-desktop/security/advisories/new) 提交，不要公开发 Issue。
- 如果问题在官方 `dsh web` profile 中也能复现，请向 DeepSeek Harness 上游项目反馈。

### 本地开发

在 macOS 上使用 Node.js 24.17.0，然后运行：

```sh
npm ci --registry=https://registry.npmjs.org
npm test
npm run smoke
```

保持改动聚焦。不得 patch、vendor 或重写官方 DSH 载荷。不得提交凭据、`$DSH_HOME`、构建产物、签名证书或公证密钥。行为变更必须补充或更新可执行测试；用户文档需同步更新中英文。

### Pull Request

较大的功能或架构变更请先建 Issue。PR 中说明用户可见结果、实际运行的验证命令，并标注打包、生命周期、更新器、安全或兼容性风险。`main` 分支需要 CI 通过后才能合并。
