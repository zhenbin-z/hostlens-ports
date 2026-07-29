# HostLens 架构

[English](ARCHITECTURE.md) | [日本語](ARCHITECTURE.ja.md) | [简体中文](ARCHITECTURE.zh-CN.md)

## 架构目标

HostLens 将分散的平台观测结果转换成规范化、带证据的主机模型。

```text
Platform Collectors
        ↓
Normalizer
        ↓
Unified Host Model
        ↓
Identity and Relationship Resolution
        ↓
Snapshot and Change Engine
        ↓
Query and Context Selection
        ↓
UI, Alerts, MCP, and Explain
```

桌面 UI、未来的 MCP Server 和未来的 LLM 功能应该使用同一份结构化模型，
而不是各自解析系统命令输出。

## 各层职责

### Collectors

Collector 负责收集平台事实，并保留采集失败信息。

- macOS：`lsof`、`ps`、launchd、Homebrew 和网络配置；
- Linux：`/proc`、`ss`、systemd、cron、firewalld 和 nftables；
- 容器：Docker 或 Podman API 与命令 Adapter。

Collector 不负责判断观测结果是否重要，也不负责生成面向用户的解释。

### Normalizer

Normalizer 将平台专用输出映射为稳定的共享类型。缺失或因权限受限无法取得的
字段应保持缺失或 unknown，不能凭空补全。

### Identity Resolver

Identity Resolver 根据底层观测生成身份候选：

```text
process name + command + executable + cwd + parent chain
        ↓
candidate application / runtime / project / launch source
        ↓
confidence and evidence
```

能够确定性处理的部分应优先使用规则和结构化目录，再考虑概率性解释。

### Relationship Engine

关系引擎连接独立采集到的资源：

```text
Process listensOn Socket
Process startedBy LaunchSource
Process belongsTo Project
Service launches Process
Container exposes Socket
Package provides Executable
```

### Snapshot and Change Engine

Snapshot 记录规范化状态，比较结果应成为有类型的变化，而不是一段自然语言：

```text
Created
Started
Stopped
Changed
Opened
Closed
Enabled
Disabled
Added
Removed
```

第一版可以只在本次 HostLens 运行期间保留内存快照。持久化属于后续阶段。

### Query and Presentation

桌面 UI、Local API、MCP Tool、Alert 与 Explain 都应查询 Host Model。
显示层可以格式化事实，但不能维护第二套身份识别逻辑。

### Context Selection

未来的 Explanation 与 External Query 只应接收完成任务所需的最少 Fact、
Relationship、Change、Policy 与 Evidence。Context Selection 不只是 LLM
优化，也是 Privacy 与 Accuracy 边界。

0.2 的 Export 同样遵循该原则。Sanitized Summary 是从 Host Model 中有意选择的
Projection，而不是所有采集 Field 的 Dump。

## 0.2 版本的 Host Model

0.2 有意从一个小模型开始：

```ts
interface Evidence {
  source: string;
  collectedAt: string;
  confidence: "high" | "medium" | "low";
  detail?: string;
}

interface ProcessIdentity {
  displayName: string;
  kind:
    | "system"
    | "application"
    | "service"
    | "development"
    | "unknown";
  project?: ProjectIdentity;
  launchSource?: LaunchSource;
  evidence: Evidence[];
}

interface LaunchSource {
  kind:
    | "launchd"
    | "homebrew"
    | "docker"
    | "package-script"
    | "manual"
    | "unknown";
  label?: string;
  confidence: "high" | "medium" | "low";
}
```

具体 TypeScript 类型可以在实现中调整，但 Identity、Source、Confidence 和
Evidence 必须保持为不同概念。

已发布的0.2会在每个Listener上分别保存`ProcessIdentity`与`LaunchSource`，
并用确定性的内存`SessionChanges`包装每次成功的`PortSnapshot`。
`SessionMonitor`负责上一份成功Snapshot及累积的New / Changed / Closed事件；
这些Session State不会写入磁盘。

0.2 只关注：

- `Process`
- `Socket`
- `ProjectIdentity`
- `LaunchSource`
- `Evidence`

`Service`、`FirewallPolicy`、`ScheduledJob`、`Package` 等对象，只在真正
实现对应 Collector 和 UI 时加入。

## 0.3版本的Service Model

0.3已经同时实现Collector和独立UI，因此正式加入`Service`。Service不会被推测为
与Process、Socket或Launch Source相同的对象。

```text
Configured Plist ─┐
launchctl State ──┼─→ Service ─→ Direct / Descendant Process ─→ Socket
Homebrew State ───┘
```

每个Service保留Manager、Label、Kind、Scope、Ownership、统一后的Status、Startup
Behavior、Program、Arguments、Plist Path、PID、Exit Status、Observation完整度、
Confidence和Evidence。Collector失败或权限不足时，系统会保留Partial Object，而
不会删除已经确认的配置。

Relationship使用带Evidence的Identifier表示。同一Plist Label对应的Homebrew和
launchd Observation会合并为一个Service。Apple Job和临时Application Runtime Job
仍保留在Model中，但默认隐藏，让普通视图优先显示Configured Third-party Service。

## 0.5版本的Runtime / Package模型

0.5在不把HostLens变成Package Manager的前提下，加入Runtime Installation与
Package Manager Environment：

```text
Runtime installation
  └── Package-manager environment
        └── Package
              └── Provided executable
                    └── Process / Service / Socket
```

`RuntimeInstallation`、`GlobalPackage`和`RuntimeRelationship`保留稳定ID、
Observation完整度、不可用字段、Confidence与Evidence。只有存在可观察的Executable
或Install Path Evidence时才建立Relationship；仅仅Package Name相同并不充分。

Node.js Manager可能提供传统Global Inventory。Python不存在统一Global Scope，
因此pip结果会明确描述为各个已发现Environment中的Package。Manager缺失、Path受限
或Command失败时，系统会保留Warning与Partial Result，而不是制造错误的空Inventory。

Runtime / Package采集使用60秒内存缓存，使频繁Socket刷新保持响应。
复制与导出摘要是结构化模型的Projection；脱敏导出会移除私人
Home路径与常见携带Secret的参数。

## 0.6版本的Persistent Change模型

0.6在同一套Normalized Host Model之后加入本地SQLite Store：

```text
HostObservationSnapshot
  → Deterministic Projection
  → Typed ChangeEvent
  → Bounded Local Timeline
  → Watch / Ignore Preference
  → 带Cooldown的Desktop Notification
```

第一次Observation作为Baseline，后续比较会剔除Collection Timestamp和Evidence
Timestamp等易变值。Port使用Socket Identity；Configured Third-party Service、
Active Interface、Default Route、DNS / VPN Context、Runtime及Package构成其他
Persistent Resource。临时Application Job和非默认Route波动会被主动排除。

Schema具有版本并经过Migration测试。Retention可配置，同时硬性限制为1,000个Event和
500个Snapshot。Observation、Preference、Alert Delivery与Setting只保存在Electron
本地User-data目录中，不上传，也不要求账号。Alert由Typed Evidence产生，不表示
Security Verdict。

## 0.7版本的Linux Adapter

0.7保留共享Host Model，只替换平台采集器：

```text
macOS                         Linux
lsof / ps                     ss / ps / procfs
launchd / Homebrew            systemd
networksetup / route          iproute2 / resolv.conf
不做Firewall判断              只读firewalld Observation
            ↓
      Shared HostSnapshot
```

当`ss`无法显示PID时，Linux Socket仍作为有效的Partial Observation保留。
Systemd Discovery合并Loaded Unit与Configured Unit File，再分批读取Property。
Network Adapter记录Interface、Route、DNS、VPN形式Tunnel Interface以及
firewalld State / Zone，但不会声称Port已经被允许或可以到达。Runtime / Package
Discovery共享同一Unix Inventory Pipeline，同时保留来源平台。

Renderer、Persistence、Change Engine、Alert、Export及三语Dictionary在两个平台上
消费相同的Normalized Type。Linux Desktop Packaging不会向Renderer开放命令执行权。

## 未来模型

长期模型可能包含：

```text
Environment
Host
NetworkDevice
Peripheral
User
Process
Service
Socket
NetworkInterface
Route
FirewallPolicy
ScheduledJob
StartupItem
Package
Runtime
Project
Container
ConfigFile
LogSource
Snapshot
ChangeEvent
AlertRule
ActionPlan
ActionExecution
AuditEvent
```

这是一份方向清单，不要求过早创建没有实现的抽象对象。

## 一份模型，多种视图

相同的观测事实应该支持不同体验，而不能产生彼此矛盾的真相：

```text
Unified Environment Model
  ├── Personal view
  ├── Developer view
  ├── IT view
  ├── Small-business view
  └── MCP and AI view
```

不同 View 可以改变术语、默认设置和信息密度。个人视图可以显示“在后台自动启动”，
Evidence View 则显示 launchd Label 与 plist Path。二者必须引用同一个 Object
与 Evidence。

## 从 Host 走向 Environment

Single-host Inspection 与中小企业 Environment Intelligence 应共享概念，但采用
不同的 Deployment 形态：

```text
Desktop
local collectors → local model → local UI / query

Small business
host and device collectors → local hub → environment graph
  → business console / alerts / local AI
```

未来 Environment Resource 可以包括 PC、Mac、Linux Server、NAS、Printer、
Router、Switch、Wi-Fi Access Point 与部分 Cloud Service。

这并不意味着 0.2 应引入 Multi-host Complexity。可靠的 Single-host Identity
Model 是有意义的 Topology 和 Cross-device Diagnosis 的前提。

## 网络语义

HostLens 必须区分：

```text
Bound
Reachable
Allowed
Tested
```

例如：

```text
Binding
0.0.0.0:8080

Host firewall
Unknown

LAN reachability
Not tested

Internet reachability
Unknown
```

绑定非回环地址意味着 network-facing，但不能证明它能够从局域网或互联网访问。

## 失败与权限语义

数据采集是尽力而为的。缺失值可能意味着：

- 扫描过程中进程已经退出；
- 操作系统限制了访问；
- 平台没有提供该字段；
- Collector 不可用；
- 解析失败。

这些情况应该表现为警告或 Evidence 状态，不能悄悄转换成错误事实。
HostLens 应在不要求管理员权限的情况下工作，并优雅降级。

## 隐私边界

命令、环境变量、路径和配置文件可能包含秘密信息。

- 默认不采集环境变量；
- 不向 Renderer 暴露任意文件读取；
- 不在非必要情况下长期保留原始命令输出；
- 对测试 Fixture 和错误报告进行脱敏；
- 未经用户明确操作，不向外部服务发送主机数据。

## Schema 演进

在 Host Model 成为公开 API 前，共享类型需要具备版本管理能力。只有在稳定的
资源 ID、可空规则、Evidence 语义和兼容性测试建立以后，才开始 MCP 与
Local API 工作。
