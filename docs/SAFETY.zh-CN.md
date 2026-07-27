# HostLens 安全模型

[English](SAFETY.md) | [日本語](SAFETY.ja.md) | [简体中文](SAFETY.zh-CN.md)

## 原则

HostLens 获得权限的速度，必须慢于它获得理解能力的速度。

安全的长期演进顺序是：

```text
Inspector
  ↓
Explainer
  ↓
Advisor
  ↓
Supervised Operator
  ↓
Policy Automation
  ↓
Bounded Autonomous Agent
```

每一级都依赖前一级建立的可靠性、Evidence 和可审计性。

## Level 0：Inspector

HostLens 只采集和展示主机状态。

- 只读；
- 不向 LLM 提供 Shell；
- 不修改进程、服务、防火墙或文件；
- 所有结论都带 Evidence；
- 明确展示未知信息。

当前产品处于这个级别。

## Level 1：Explainer

规则和可选 LLM 解释用户选中的结构化对象。

- 为什么这个端口开放？
- 这个进程是什么？
- 为什么这个服务会随系统启动？
- 本次运行期间发生了什么变化？

LLM 只接收选中的结构化数据，而不是获得机器的自由访问权限。它不能执行命令。

## Level 2：Advisor

HostLens 可以提出运维计划，但不执行。

每份计划应该包含：

- 观测到的问题；
- 支持结论的 Evidence；
- 建议步骤；
- 风险及预期影响；
- 结果验证方法；
- 必要时的回滚方案。

## Level 3：Supervised Operator

HostLens 可以在用户明确批准后执行预定义操作。

```text
Detect
  ↓
Create exact action plan
  ↓
Show target, parameters, risk, and impact
  ↓
User approval
  ↓
Execute predefined operation
  ↓
Collect new state and verify
  ↓
Record audit event
```

系统中不存在无限制 Shell Tool。每个操作都有类型化目标和经过校验的参数。

## Level 4：Policy Automation

用户可以通过明确规则，授权狭窄、低风险的自动操作。

每条 Policy 都需要：

- 资源范围；
- 允许的操作集合；
- 前置条件；
- 最大尝试次数；
- cooldown；
- 必要时的执行时间窗口；
- 失败和升级处理；
- 随时禁用机制。

## Level 5：Bounded Autonomous Agent

Agent 只能在明确授予的边界内观察、诊断、规划、执行、验证和升级。

边界示例：

```text
Hosts
- development-server-01

Services
- nginx
- application-api

Allowed operations
- read logs
- restart service
- reload configuration
- run health check

Forbidden operations
- delete files
- modify users
- modify firewall
- reboot host

Maximum retries
1
```

拥有 root 权限本身绝不等于获得操作授权。

## Operations Engine 要求

未来的写入能力属于 Operations Engine，而不是 LLM Prompt。

```ts
interface OperationDefinition {
  id: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiredPrivileges: string[];
  supportedPlatforms: string[];
  reversible: boolean;
  requiresApproval: boolean;
  preconditions: string[];
  verificationSteps: string[];
}
```

操作必须：

- 预先定义；
- 参数范围狭窄且有类型；
- 按平台和资源列入 Allowlist；
- 独立授权；
- 执行前后可观测；
- 只有明确声明后才允许安全重试；
- 写入 Audit Log。

## LLM 边界

LLM 可以：

- 理解用户意图；
- 选择只读结构化查询；
- 解释 Evidence；
- 汇总变化；
- 编写诊断清单；
- 提出运维计划。

默认情况下，LLM 不得：

- 执行任意 Shell；
- 读取任意文件；
- 获取管理员权限；
- 结束进程；
- 修改启动配置；
- 修改 Firewall Policy；
- 根据进程名直接判断恶意软件；
- 将未经确认的机器数据发送给外部 Provider。

## Evidence 与措辞

安全也体现在表达方式上。HostLens 应该说：

```text
New network-facing listener observed
```

而不是在没有明确 Policy 和 Evidence 时宣称：

```text
Dangerous port detected
```

## 开发 Operations 之前的前提

HostLens 不应该在具备以下条件之前开始 Supervised Operations：

- 稳定的资源 ID；
- 可靠的采集与 Source Attribution；
- Snapshot 与类型化变化；
- 确定性的 Operation Definition；
- 权限与审批流程；
- 操作前后的条件检查；
- Audit 存储；
- 失败处理；
- 证明危险操作无法绕过审批的测试。

