# 为什么 HostLens 选择开源

[English](OPEN_SOURCE.md) | [日本語](OPEN_SOURCE.ja.md) | [简体中文](OPEN_SOURCE.zh-CN.md)

## 信任需要可见性

HostLens 会检查敏感的本地 Context：Process、Command、Path、Port、
Startup Source、Network 信息，以及未来设备和服务之间的关系。

用户应该能够确认：

- HostLens 采集什么；
- 它使用哪些 System Interface；
- 哪些信息保留在本机；
- 是否会向网络发送数据；
- 一个 Identity 或 Warning 是如何得出的；
- 一个 Operation 需要哪些权限。

对于本地系统检查器而言，源代码可见性本身就是 Trust Model 的一部分。

## 兼容性是一个社区问题

操作系统会因版本、安装方式、Package Manager、硬件、Desktop Environment 和
本地配置而产生差异。macOS、Ubuntu、RHEL、launchd、systemd、Homebrew、
Docker 和开发工具都有单个 Maintainer 无法独自复现的 Edge Case。

开放开发可以：

- 报告经过脱敏的平台专用故障；
- 贡献 Parser Fixture 与 Compatibility Fix；
- 审查 Collector 安全性；
- 改善 Accessibility 与 Localization；
- 基于稳定 Interface 构建 Integration；
- 避免 HostLens 只在 Maintainer 自己的机器上正确运行。

## 独立有用的公共基础

Community Foundation 本身必须具有实际价值：

- Single-host、Read-only Inspection；
- 透明的 Collector 与 Evidence；
- Shared Schema 与 Foundational Interface；
- Local-first Desktop 使用方式；
- Provider-neutral、可选的 AI Integration；
- Interface 成熟后的安全只读 Query 与 MCP。

AI 与 Cloud Service 是可选客户端，而不是理解本地机器的必要条件。

## 长期公开的技术项目

HostLens 希望成为一个长期公共工程项目，而不是一次性 Demo 或薄弱的 AI Wrapper。

保持一个有用的开放基础可以：

- 展示 Systems 与 Infrastructure Engineering 质量；
- 建立可复用的公共知识；
- 长期积累信任和个人技术声誉；
- 吸引关心同类问题的 Contributor；
- 让项目不依附于单个 Employer、Model Provider 或商业产品周期。

## 开源不等于公开未来的所有产品

开源承诺适用于本仓库中按照 License 发布的代码。它不要求未来所有 HostLens
Service、Compatibility Pack、Managed Deployment、Business Coordination、
Model 或 Operations 功能都采用相同包装与 License。

未来边界应根据真实产品需求确定，并且清楚记录。已经发布版本的实用性、隐私承诺
和 License 权利不能在之后被削弱。

## 当前 License

HostLens Ports 当前基于
[Apache License, Version 2.0](../LICENSE)发布。

Apache-2.0 允许在其条款下使用、修改和再发布，并包含明确的 Patent Grant。
HostLens 名称和 Logo 由[NOTICE](../NOTICE)另行说明；开源代码 License 不授予
Trademark 权利。

本文解释项目意图，不构成法律意见。

