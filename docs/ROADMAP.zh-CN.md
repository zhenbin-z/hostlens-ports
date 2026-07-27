# HostLens Roadmap

[English](ROADMAP.md) | [日本語](ROADMAP.ja.md) | [简体中文](ROADMAP.zh-CN.md)

这份 Roadmap 描述产品开发顺序，而不是固定日期。后续阶段可以根据 HostLens
在真实 macOS 与 Linux 环境中的验证结果进行调整。

指导顺序是：

```text
See
  ↓
Identify
  ↓
Relate
  ↓
Remember
  ↓
Explain
  ↓
Advise
  ↓
Operate safely
```

## 已发布：0.1.0 — 看见监听端口

0.1.0 建立了第一个可用产品：

- 实时扫描 macOS TCP Listener；
- 显示 PID、Parent PID、User、Command 和 Executable 等详细信息；
- 区分 Local-only 与 Network-facing；
- 支持进程与端口的搜索、排序和过滤；
- 提供 Menu Bar 与完整 App Window；
- 支持 English、日本語、简体中文；
- 保持只读和 Local-first Architecture。

## 开发中：0.2.0 — Host Identity and Session Awareness

0.2 希望回答：

> **这个端口背后真正是谁、它从哪里启动，以及本次 HostLens 运行期间发生了什么变化？**

0.2 仍然是一个聚焦 Single-host 的 Port Inspector。目标是让同一份可信事实服务
于个人、Developer 和中小企业情信人员，而不是开发三个独立产品。

### Scanner 可靠性

- 改善 PID、PPID、User、Command、Executable 和 Working Directory 的采集；
- 在不阻塞完整扫描的前提下检查 Parent Process Chain；
- 明确展示采集失败与权限限制；
- 继续完善 macOS Parser Fixture 与回归测试；
- 进程信息补全失败时仍保留 Socket 观测。

### 进程与项目身份

- 识别 Vite、Next.js、React Tooling、Nuxt 和 webpack 等开发服务器；
- 根据 Command、Executable、Working Directory 和 Parent Process 推断项目；
- 分离原始 Process Name 与友好显示身份；
- 保留每项身份归因使用的 Evidence；
- 为推断身份附加 Confidence。

### Source Attribution

第一批识别：

- launchd；
- Homebrew Services；
- Docker Desktop 与 Container；
- npm、yarn、pnpm Package Script；
- Native macOS Application；
- Manual 或 Unknown。

### Session Changes

不引入数据库：

- 在内存中保留上一次成功扫描；
- 识别 New、Changed 与 Closed Listener；
- 在 App 和 Menu Bar Quick View 中显示变化；
- HostLens 退出时清除历史。

### 面向不同用户的显示方式

使用同一份 Identity / Evidence Model，提供不同信息深度：

- **个人：** 显示易懂的身份、它可能为什么运行、是否自动启动，以及 Local-only
  或 Network-facing；Command 和 Evidence 可以展开查看。
- **Developer：** 优先展示 Project、Tool、Package Script、Working Directory、
  Parent Chain、Runtime 和准确 Command。
- **情信人员：** 提供一致的技术 Identity、Collection Status、Evidence，以及
  可用于 Inventory、Support Ticket 或人工复核的当前状态 Summary。

0.2 不需要完整的 Persona 切换系统。UI 只需证明 Friendly Summary 与
Technical Evidence 可以引用同一个 Object。

### 可共享的当前状态 Summary

不使用数据库或 Cloud Service：

- 允许 Copy / Export 当前选中 Listener 的详细信息；
- 提供省略或缩短 Private Path 等 Sensitive Field 的 Sanitized Summary；
- 包含 Collection Time、Identity Confidence、Source、Exposure 和 Evidence；
- 明确它只是 Point-in-time Observation，而不是 Security Certification。

### 0.2 实现顺序

按照 Vertical Slice 顺序实现：

1. 先让原始 Socket 与 Process Observation 可靠；
2. 引入 Identity、Evidence、Confidence 与 Partial Result Semantics；
3. 使用 Sanitized Fixture 增加 Source Attribution Resolver；
4. 增加确定性的 In-memory Session Changes；
5. 增加 Friendly / Technical 显示与 Sanitized Current-state Summary。

不能绕过前一个 Slice 尚未完成的 Shared Model，提前实现后续功能。

### 0.2 完成标准

仅仅增加字段不能视为完成。

- 现有 Scanner Test 全部通过；
- 经过脱敏的代表性 Fixture 覆盖开发服务器和 Source Attribution；
- 在 Reference Mac 上记录20次 Scan Benchmark，普通开发 Workload 下
  p95 Scan Time 低于2秒；
- 每项推断身份都有 Evidence 与 Confidence；
- 进程详情缺失时不丢失 Socket，并以 Partial 或 Unknown 降级；
- 普通开发 Mac 上扫描期间 UI 保持响应；
- 相同 Snapshot 之间的 New、Changed、Closed 判断是确定性的；
- 非技术用户无需打开 Raw Command 就能理解主要 Identity 与 Exposure；
- 技术用户能够检查每个 Friendly Identity 背后的 Evidence；
- 无需 Persistence 或 Background Network Traffic 即可复制 Current-state Summary；
- Sanitization Test 能证明 Private Home-directory Prefix 和常见可能携带 Secret
  的 Command Argument 不会进入 Sanitized Output；
- HostLens 保持只读，不向网络发送机器信息。

### 0.2 明确不做

- 数据库或持久化历史；
- UDP 扫描；
- 完整 macOS Host Inventory；
- Linux GUI 功能对等；
- Device Discovery、Multi-host Management 或 Business Hub；
- MCP；
- LLM 或 Chat；
- 修改防火墙；
- 结束进程；
- 自动修复。

## 下一步：Unified Host Model 与 macOS Inspector

在 0.2 验证 Host Identity 之后：

- 正式定义 `Process`、`Socket`、`Project`、`LaunchSource` 与 `Evidence`；
- 增加 launchd Service 和 Startup Item；
- 建立 Homebrew Services 与 Docker 关系；
- 展示 Network Interface、Route、DNS 和 VPN Context；
- 增加展示 Background Activity 与 Startup Behavior 的 Personal Overview；
- 增加展示 Project、Runtime 与 Local Service 的 Developer View；
- 增加展示 Machine Inventory、Evidence 与 Reviewable Summary 的 IT View；
- 只有在真实 Collector 和 UI 存在时才加入新的资源类型。

## Linux 一等支持

Linux 使用共享 Host 概念，同时保留平台专用 Evidence。

推荐顺序：

1. Process 与 Listening Socket；
2. systemd Service；
3. systemd Timer 与 cron；
4. Startup Source Attribution；
5. firewalld；
6. journal Summary；
7. Docker 与 Podman；
8. Package 与 Runtime Inventory。

第一批目标是 Ubuntu 和 Red Hat Enterprise Linux。Headless 和 Multi-host
属于独立的后续问题。

## Persistent Changes 与 Alerts

规范化身份稳定后：

- 持久化轻量 Snapshot；
- 生成类型化 `ChangeEvent`；
- 提供 Timeline；
- 支持 Alert Rule 与 cooldown；
- 提供 Desktop Notification；
- 允许用户标记关注资源。

Alert 应该解释 Evidence 与变化，而不是制造安全裁决。

## 个人与中小企业体验

不分叉底层事实，从 Shared Model 发展两种额外体验。

### Personal Host Understanding

- Background Application 与 Startup Behavior；
- 普通语言解释与可展开 Evidence；
- Recent Changes；
- Resource 与 Network Context；
- 避免无依据安全判断的 Attention Guidance。

### 中小企业情信部门

- Mac 与 Linux Host 的一致检查；
- Current-state Inventory 与 Reviewable Report；
- 重要机器的 Changes 与 Alerts；
- Service、Startup、Schedule 与 Firewall Context；
- Local Deployment 与 Local Processing；
- 可用于 Troubleshooting 和交接的 Evidence。

这些能力最初以 Single-host 形式提供，不要求 Enterprise Fleet Management。

## Local Query API、MCP 与 Explain

稳定的 Query Layer 可以服务于：

- Desktop UI；
- 只读 Local API；
- MCP Tool；
- 可选 Explain 功能。

第一个 AI 功能应保持狭窄：

```text
Selected structured object
  ↓
Minimal sanitized JSON
  ↓
External LLM chosen by the user
  ↓
Explanation, implications, and next investigation steps
```

这一阶段不包含无限制 Shell、Free-form Agent 或自动 Tool 执行。

## 中小企业 Environment Intelligence

只有在 Single-host Model 与 Changes 足够可靠后，HostLens 才连接办公室环境：

- Mac、PC 与 Linux Server；
- NAS 与 Shared Storage；
- Printer；
- Router、Switch、Wi-Fi 与 Local Network Service；
- 部分 Cloud Dependency；
- Local Business Hub；
- Topology 与 Dependency Relationship；
- 集中的 Changes、Alerts 与 Reports；
- Local-first AI Context。

完成标准不是“列出了很多 Device”。HostLens 应帮助判断办公室级症状来自
Endpoint、Shared Service、Network Device 还是 Upstream Dependency。

## Advisory 与 Supervised Operations

只有在可靠 Identity、Relationship、Snapshot 与 Evidence 建立后：

1. 生成诊断清单和 Operations Plan；
2. 展示 Risk、Impact、Verification 与 Rollback；
3. 引入经过批准的预定义 Operation；
4. 保存操作前后 Snapshot；
5. 验证结果；
6. 保存 Audit Record。

## Policy Automation 与 Bounded Autonomy

Supervised Operations 被证明安全后，可以加入低风险自动化。每条 Policy 都必须
具有 Scope、允许 Tool、Retry 上限、cooldown、失败处理和用户 Override。

长期 Agent 依然必须有边界。HostLens 永远不应成为由 LLM 控制的通用 root Shell。

## 相关文档

- [产品理念](PRODUCT.zh-CN.md)
- [架构](ARCHITECTURE.zh-CN.md)
- [安全模型](SAFETY.zh-CN.md)
- [为什么HostLens选择开源](OPEN_SOURCE.zh-CN.md)
