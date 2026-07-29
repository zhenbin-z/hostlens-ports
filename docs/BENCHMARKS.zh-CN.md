# HostLens 扫描器基准测试

[English](BENCHMARKS.md) | [日本語](BENCHMARKS.ja.md) | [简体中文](BENCHMARKS.zh-CN.md)

本文记录可重复执行的扫描器检查结果，而不是营销性质的性能承诺。监听端口数量、
正在运行的应用、权限、存储负载和操作系统版本都会影响实际结果。

## 0.4版本参考测试

记录于2026年7月29日：

| 项目 | 结果 |
| --- | --- |
| 平台 | macOS，Apple Silicon（`arm64`） |
| Runtime | Node.js `v22.22.2` |
| 连续扫描 | 20 |
| 最终扫描Interface | 29 |
| 最终扫描Route | 52 |
| Socket Relation | 30 |
| 缺少Evidence的Relation | 0 |
| Network最小值 | 7.45 ms |
| Network中位数 | 7.98 ms |
| Network p95 | 12.13 ms |
| Network最大值 | 14.73 ms |

此项测试在取得Current Port Snapshot后运行Production macOS Network
Collector与Relationship Resolver。完成目标为Network p95低于1秒，并且每条
Socket Relation都有Evidence。本次测试通过两项目标。

```bash
yarn benchmark:network
```

## 0.3版本参考测试

记录于2026年7月28日：

| 项目 | 结果 |
| --- | --- |
| 平台 | macOS、Apple Silicon（`arm64`） |
| 运行时 | Node.js `v22.22.2` |
| 连续扫描次数 | 20 |
| 最后一次扫描的Listener数量 | 29 |
| 最后一次扫描的Service数量 | 535 |
| 默认显示的Service数量 | 18 |
| 与监听端口相关联的Service数量 | 5 |
| 缺少Evidence的Service数量 | 0 |
| Combined最小值 | 710.34 ms |
| Combined中位数 | 726.53 ms |
| Combined p95 | 751.64 ms |
| Combined最大值 | 2,262.05 ms |

Combined测试会依次运行生产版本的Port Scanner、Services Scanner和Relationship
Resolver。第一次扫描还会构建Configured Service Cache。0.3的完成目标是Combined
p95低于3秒，且每个Service都有Evidence。本次测试通过了两个目标。

macOS的User launchd Domain包含数百个Runtime Job。由于launchd只提供Label和
State，而不提供Configured Plist或Program Path，其中大部分只能作为Partial
Observation保留。Apple所属Job和临时Application Job不会丢弃，但默认隐藏；本次
参考测试中，默认视图保留了18个Configured Third-party Service。

可以在本机运行相同测试：

```bash
yarn benchmark:services
```

## 0.2版本参考测试

记录于2026年7月27日：

| 项目 | 结果 |
| --- | --- |
| 平台 | macOS、Apple Silicon（`arm64`） |
| 运行时 | Node.js `v22.22.2` |
| 连续扫描次数 | 20 |
| 最后一次扫描的Listener数量 | 30 |
| 部分观测 | 0 |
| 缺少身份识别证据 | 0 |
| 缺少启动来源证据 | 0 |
| 最小耗时 | 67.38 ms |
| 中位数 | 69.78 ms |
| p95 | 78.24 ms |
| 最大耗时 | 100.45 ms |

0.2的完成目标是在正常开发负载下p95低于2秒。本次测试通过该目标。

在本机运行相同测试：

```bash
yarn benchmark:scanner
```

该脚本会使用生产环境的macOS扫描器连续执行20次只读观测，确认每个Listener都
具备身份与来源证据，然后输出延迟统计。它不会持久化或上传所观测到的机器信息。
