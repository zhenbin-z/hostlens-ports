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
Query, UI, Alerts, MCP, and Explain
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

0.2 只关注：

- `Process`
- `Socket`
- `ProjectIdentity`
- `LaunchSource`
- `Evidence`

`Service`、`FirewallPolicy`、`ScheduledJob`、`Package` 等对象，只在真正
实现对应 Collector 和 UI 时加入。

## 未来模型

长期模型可能包含：

```text
Host
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

