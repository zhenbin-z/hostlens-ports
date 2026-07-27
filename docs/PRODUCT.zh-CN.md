# HostLens 产品理念

[English](PRODUCT.md) | [日本語](PRODUCT.ja.md) | [简体中文](PRODUCT.zh-CN.md)

## 愿景

HostLens 是一个对人友好的系统检查器，也是一个操作系统知识层。

它希望解释：

- 一台机器上正在运行什么；
- 为什么它会运行；
- 它是如何启动的；
- 它属于哪个项目、应用、服务、容器或软件包；
- 它使用了哪些端口及其他资源；
- 这些资源之间有什么关系；
- 最近发生了什么变化。

一句话产品定位是：

> **Understand what is really running on your machine.**  
> 理解你的机器上真正运行着什么。

HostLens 从检查器开始。只有在能够可靠地观察、识别、关联和解释主机状态之后，
才会逐步发展为一个有明确边界的运维 Agent。

## 产品原则

### 先理解信息，再执行操作

初期的产品流程是：

```text
Collect
  ↓
Normalize
  ↓
Relate
  ↓
Explain
  ↓
Notify
```

HostLens 必须先理解系统，然后才考虑控制系统。

### 结构化事实是核心资产

HostLens 的价值不在于能够调用 `lsof`、`ps`、`launchctl`、`systemctl`
或某个 LLM。长期价值来自把这些信息源转换成统一、可信、可查询的 Host Model。

原始观测可能只是：

```text
node
PID 1234
127.0.0.1:5173
```

有意义的主机身份信息应该是：

```text
Vite Development Server

Project
~/Developer/example-app

Started by
yarn dev

Runtime
Node.js 22

Listening
127.0.0.1:5173

Exposure
Local machine only
```

### 展示关系，而不是包装命令输出

HostLens 应该建立以下关系：

```text
Project
  ↓ defines
package script
  ↓ launches
Process
  ↓ listens on
Socket
```

它不应该变成一组彼此割裂的系统命令 GUI。

### 区分事实、推断与未知

每个重要结论都应该说明：

- 直接观测到了什么；
- 推断出了什么；
- 推断的可信度；
- 还有哪些内容未知。

HostLens 不能把尽力而为的归因包装成没有依据的事实。

### 没有 AI 也必须有价值

核心检查器必须在没有 LLM 时依然有用。AI 可以解释用户明确选择的结构化信息，
但不能成为产品基础价值本身。

### 隐私优先

主机数据可能包含用户名、路径、项目名、命令、网络地址和秘密信息。数据采集默认
保留在本地。未来任何外部 AI 功能都必须展示并最小化实际发送的结构化信息。

## HostLens 是什么

- 主机信息检查器；
- 对开发者友好的进程与服务解释器；
- 规范化的操作系统数据层；
- 主机身份和资源关系的本地事实来源；
- 主机状态变化感知工具；
- 未来的只读 API 与 MCP Server；
- 最终可能发展为受监督、受策略约束的运维系统。

## HostLens 不是什么

至少在早期阶段，它不是：

- 杀毒软件；
- EDR 平台；
- 漏洞扫描器；
- 磁盘清理器；
- 自动系统优化工具；
- 恶意软件裁决引擎；
- 无限制 Shell Agent；
- 默认要求 root 权限的自治程序。

安全相关输出应该优先采用：

```text
Observation
Evidence
Possible implication
Recommended investigation
```

除非有充分证据，否则不应直接宣称：

```text
Malicious
Dangerous
Safe to delete
```

## 平台方向

macOS 是第一个产品环境。Linux 是一等目标，而不是附带移植。Ubuntu 和
Red Hat Enterprise Linux 将共享统一概念，同时保留平台专用的 Collector
和 Evidence。

只有在 Host Model 和 Collector 边界稳定后，才考虑 Windows。

## 成功标准

HostLens 的成功意味着它能够：

- 准确识别资源身份；
- 解释身份是如何得出的；
- 关联进程、Socket、服务、项目和启动来源；
- 区分事实与推断；
- 在不制造焦虑的前提下解释变化；
- 不依赖 LLM 也有实际价值；
- 为未来客户端提供稳定的结构化数据；
- 提供可验证的运维方案；
- 最终只在明确授权边界内安全执行操作。

功能数量和包装了多少系统命令都不是成功指标。

