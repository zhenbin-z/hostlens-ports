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

## 已发布：0.2.0 — Host Identity and Session Awareness

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

2026年7月27日记录的完成证据：

- 扫描解析、身份、启动来源、国际化、Session Changes和摘要脱敏共36项自动测试通过；
- 生产Electron构建与TypeScript验证通过；
- 真实macOS扫描识别出Package Script、原生应用、Docker、launchd和未知来源，
  同时保留信息不完整的Socket观测；
- 真实UI验证了新增/关闭变化及三种界面语言；
- 30个Listener、连续20次的参考基准测试得到p95 78.24 ms。
  详见[扫描器基准测试](BENCHMARKS.zh-CN.md)。

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

## 已发布：0.3.0 — Services & Startup Inspector

0.3需要回答：

> **这台Mac配置了哪些服务和启动项、哪些正在运行，以及哪些进程与监听端口
> 属于它们？**

### 服务清单

- 收集当前用户launchd Domain，包括已加载但未运行的Job；
- 从用户与Local Library的plist目录发现已配置的第三方LaunchAgent /
  LaunchDaemon；
- Homebrew可用时收集Homebrew Services；
- 保留已配置但停止的项目，而不是只显示正在运行的进程；
- 区分用户Agent、系统Agent与系统Daemon；
- 单独分类Apple系统Job，在保留技术证据的同时降低默认视图噪音。

### 状态与启动行为

- 统一Running、Loaded、Stopped、Failed、Disabled和Unknown状态；
- 显示观测到的PID与Last Exit Status；
- 根据plist、launchd状态和Homebrew证据推断Automatic、On demand、
  Disabled或Unknown；
- 显示Program、Arguments、plist路径、Label、Manager和Scope；
- plist或命令无法读取时仍保留Partial Object；
- 为推断的状态与启动策略提供Confidence和Evidence。

### 统一关系

- 将`Service`建模为独立于`Process`、`Socket`和`LaunchSource`的对象；
- 关联Service与直接、后代Process；
- 关联Service与这些Process拥有的监听Socket；
- 合并描述同一Service的Homebrew与launchd观测；
- 允许用户在Service和相关Port之间跳转，而不创建第二套Identity。

### Services界面

- 在完整App与菜单栏Panel中加入一等Ports / Services视图；
- 提供搜索、Manager、Status、Startup、Scope和Apple-system筛选；
- 提供确定性排序；
- 技术字段之前先显示普通语言Service摘要；
- 在可展开技术详情中显示准确Label、路径、Arguments、关系、Confidence与Evidence；
- 支持英语、日语和简体中文。

### 0.3完成标准

- 脱敏Fixture覆盖launchctl、plist、Disabled State、Homebrew Output，
  包括Malformed与Permission-limited情况；
- Relationship Test覆盖直接Process、后代、多个Socket、停止Service以及
  Homebrew / launchd去重；
- 已配置但停止的Service始终可见；
- Optional Collector失败不会丢失其他Collector取得的Port或Service事实；
- UI明确区分Observed Fact和Inferred Status / Startup Behavior；
- 默认Personal View无需launchd知识也能理解；
- 技术用户能够检查每个Relationship背后的Evidence；
- 20次参考Benchmark在正常开发负载下保持响应；
- Production Build与真实macOS UI / Collector在三种语言下通过；
- HostLens保持只读、本地、不使用持久化历史，也不发送机器信息。

2026年7月28日在`develop/0.3.0`分支记录的完成证据：

- 52项自动化测试全部通过，覆盖Port / Service解析、权限受限时的Partial
  Object、Status / Startup统一、Relationship、去重、Optional Collector失败、
  筛选、排序和多语言；
- Production Electron Build与TypeScript检查通过；
- 真实macOS Collector确认了Configured、Running、Loaded和Stopped的第三方
  Service，同时通过明确筛选保留Apple及Application Runtime Job；
- 英文、日文、简体中文真实UI检查、默认筛选以及Service跳转到Related Port通过；
- 20次Combined Benchmark中没有Service缺少Evidence，p95为751.64 ms。
  详见[扫描器基准测试](BENCHMARKS.zh-CN.md)。

### 0.3明确不做

- 启动、停止、启用、禁用或删除Service；
- 编辑plist；
- 持久化历史或Alert；
- Network Interface、Route、DNS、VPN或Firewall检查；
- Linux Service功能对等；
- 通过Privileged / Private API管理Login Item；
- MCP、LLM或Chat；
- Multi-host Management。

## 已发布：0.4.0 — macOS Host Overview & Network Context

0.4需要回答：

> **这台Mac连接到了哪些Network，Listening Service可能通过哪些Interface访问？**

- 正式定义`Process`、`Service`、`Socket`、`Project`、`LaunchSource`、
  `NetworkInterface`、`Route`、`DnsConfiguration`、`VpnConnection`与
  `Evidence`的Relationship；
- 收集macOS Interface、IPv4 / IPv6地址、Default Route、DNS Configuration与
  可以观测到的VPN Interface；
- 将Socket Bind Address关联到具体Interface，但不声称一定能穿过Firewall或从
  Internet访问；
- 区分Bound、Potentially Reachable和Actively Tested；
- 增加展示Current Network、Background Service、Startup Behavior、
  Network-facing Port与Session Change的Host Overview；
- 提供面向个人用户的说明，以及可展开的Developer / IT Evidence；
- 保持本地、只读，不进行Active LAN Scan；
- 在真实Mac上验证Collector、Relationship、性能和三语UI。

2026年7月29日记录的完成证据：

- 58项自动化测试全部通过，包括Interface、Route、DNS、VPN、
  Socket Relationship脱敏Fixture以及Optional Collector隔离；
- Production Electron Build与TypeScript检查通过；
- 真实Mac的Host Overview正确显示Primary Network、活动Interface、
  Default Gateway、DNS、可观察的VPN Context、后台服务和可能可达的Listener；
- 英文、日文、简体中文UI以及View间导航已在真实Electron App中确认；
- Wildcard Listener只关联拥有Network-scope Address的活动Interface，避免
  Link-local虚拟网卡噪音；
- 20次Network Benchmark中所有Socket Relation均带有Evidence，p95为
  12.13 ms。详见[扫描器基准测试](BENCHMARKS.zh-CN.md)。

### 0.4明确不做

- 主动测试LAN、Firewall或Internet Reachability；
- Packet Capture或Network Traffic Inspection；
- 修改Network或VPN配置；
- 持久化Network History；
- Linux Network功能对等；
- MCP、LLM或Chat；
- Multi-host Management。

## 已发布：0.5.0 — Runtimes & Global Packages Inspector

0.5把已安装开发工具与当前运行状态关联起来：

- 从System、Homebrew、nvm、pyenv等来源检查Node.js / Python Runtime；
- 检查npm、Yarn、pnpm、pip和pipx Global Package；
- 显示Package Name、Version、Manager、Runtime、Install Path与Executable；
- 将Package Executable关联到Process、Service、Project和Listening Port；
- 权限不足时保留带Evidence的Unknown / Partial Observation；
- 提供Search、Filter、Summary、Export和英日中三语UI；
- 不执行Install、Update、Uninstall、Vulnerability Verdict或每个Project的完整
  Dependency Scan。

2026年7月29日记录的完成证据：

- 70项自动化测试通过，覆盖Runtime / Package解析、关系、摘要、脱敏、已有
  Collector与显示模型；
- TypeScript检查与Production Electron构建通过；
- 在真实Mac上发现5个Node.js / Python Runtime和34个Package，不可用的Package
  Manager会保留为明确Warning；
- 英文、日文、简体中文实机UI检查通过，并验证了同名Package按Environment搜索；
- 每条Runtime / Package关系都带Evidence，Package Summary可复制或在脱敏私人
  路径后导出；
- Runtime Benchmark的Cold Scan为3,034.22 ms，缓存p95为0.03 ms，通过Cold低于
  6秒、缓存p95低于100 ms的目标。参见[扫描器基准](BENCHMARKS.zh-CN.md)。

### 0.5明确不包含

- Runtime / Package的Install、Update或Uninstall；
- Vulnerability、License或Security Verdict；
- 每个Project的完整Dependency与Lockfile分析；
- Inventory持久历史或Package Alert；
- Linux Runtime / Package同等支持；
- MCP、LLM或Chat功能；
- 通过网络发送Package或Machine Data。

## 已发布：0.6.0 — Persistent Changes & Alerts

0.6让跨应用重启的Host Change也可以被Review：

- 持久化带版本的轻量Local Snapshot；
- 为Port、Service、Network Context及Runtime / Package Inventory生成类型化
  `ChangeEvent`；
- 提供带Retention Control的有限Timeline；
- 允许Watch或Ignore Resource；
- 提供基于Evidence的Alert Rule、Cooldown与Desktop Notification；
- 每个Event都保留可检查的Structured Evidence；
- 使用带Migration测试的Local Database，不增加Telemetry。

Alert应该解释Evidence与变化，而不是制造安全裁决。
持久化Projection会排除短暂的macOS Application Job和非默认Route波动，
让Timeline优先呈现较稳定的Host State。

## 已发布：0.7.0 — Ubuntu / RHEL First-class Support

Linux使用同一套Host概念，同时保留平台专用Evidence。

- 通过`ss`和`/proc`支持Process及Listening Socket；
- 支持systemd Service及Startup Behavior；
- 收集Interface、Route、DNS、VPN Context与firewalld Observation；
- 在可用时检查Docker / Podman、Runtime与Global Package；
- 复用Relationship、Persistent Change、Alert、Report和三语UI；
- 提供`.deb`、`.rpm`和实用的GNOME Desktop Packaging；
- 通过Fixture和代表性真实环境验证Ubuntu与Red Hat Enterprise Linux；
- Command、权限或Optional Tool不可用时仍保留Partial Result。

Headless Agent、Multi-host、Service Mutation与无限制Shell属于后续问题。

2026年7月29日记录的完成证据：

- Linux Adapter通过`ss`检查TCP Listener，在权限受限时仍保留Socket并补充
  Process信息，同时复用确定性的Identity与Relationship Resolution；
- systemd清单覆盖已加载及已配置Unit File、统一Status / Startup、Unit
  Evidence、Process与Listening Port；
- iproute2 Fixture覆盖Interface、IPv4 / IPv6 Route、DNS、VPN形式Interface、
  Socket Relationship以及只读firewalld状态与Zone；
- 共享Runtime Collector支持Linux Node.js / Python以及npm、Yarn、pnpm、
  pip与pipx清单；
- macOS与Linux共享Persistent Change、Alert、Export及英/日/简中UI；
- CI验证macOS与Ubuntu，Linux Packaging生成AppImage、deb和rpm；
- Packaging前91项自动化测试与两套TypeScript检查全部通过。

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
