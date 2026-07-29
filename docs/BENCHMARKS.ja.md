# HostLens Scanner Benchmark

[English](BENCHMARKS.md) | [日本語](BENCHMARKS.ja.md) | [简体中文](BENCHMARKS.zh-CN.md)

この文書はMarketing上の性能表現ではなく、再現可能なScanner確認結果を記録します。
結果はListener数、実行中のApplication、権限、Storage負荷、OS Versionによって
変化します。

## バージョン0.5 Reference Run

2026年7月29日に記録：

| 項目 | 結果 |
| --- | --- |
| Platform | macOS、Apple Silicon（`arm64`） |
| Runtime | Node.js `v22.22.2` |
| 連続Cache Scan | 10 |
| Runtime Installation | 5 |
| Package | 34 |
| Collector Warning | 2 |
| Evidence不足Relationship | 0 |
| Cold Scan | 3,034.22 ms |
| Cache最小値 | 0.01 ms |
| Cache中央値 | 0.01 ms |
| Cache p95 | 0.03 ms |
| Cache最大値 | 0.03 ms |

Cold測定では観測可能なRuntime Installationを発見し、利用可能なPackage Managerへ
問い合わせます。InventoryはSocketより変化が少ないため、結果を60秒間Memory Cache
します。利用できないPackage Managerは、成功したObservationを削除せずPartial
Warningになります。TargetはCold Scan 6秒未満、Cache p95 100 ms未満、すべての
RelationshipにEvidenceがあることです。本実行はすべてに合格しました。

```bash
yarn benchmark:runtimes
```

## バージョン0.4 Reference Run

2026年7月29日に記録：

| 項目 | 結果 |
| --- | --- |
| Platform | macOS、Apple Silicon（`arm64`） |
| Runtime | Node.js `v22.22.2` |
| 連続Scan | 20 |
| 最終ScanのInterface | 29 |
| 最終ScanのRoute | 52 |
| Socket Relation | 30 |
| Evidence不足Relation | 0 |
| Network最小値 | 7.45 ms |
| Network中央値 | 7.98 ms |
| Network p95 | 12.13 ms |
| Network最大値 | 14.73 ms |

Current Port Snapshot取得後にProduction macOS Network Collectorと
Relationship Resolverを実行しています。Completion TargetはNetwork p95
1秒未満、すべてのSocket RelationにEvidenceがあることです。両方に合格しました。

```bash
yarn benchmark:network
```

## バージョン0.3 Reference Run

2026年7月28日に記録：

| 項目 | 結果 |
| --- | --- |
| Platform | macOS、Apple Silicon（`arm64`） |
| Runtime | Node.js `v22.22.2` |
| 連続Scan回数 | 20 |
| 最終ScanのListener数 | 29 |
| 最終ScanのService数 | 535 |
| Default表示のService数 | 18 |
| Listening Portと関連付いたService数 | 5 |
| EvidenceのないService数 | 0 |
| Combined最小値 | 710.34 ms |
| Combined中央値 | 726.53 ms |
| Combined p95 | 751.64 ms |
| Combined最大値 | 2,262.05 ms |

Combined測定ではProduction Port Scannerに続いてServices ScannerとRelationship
Resolverを実行します。初回ScanではConfigured Service Cacheも構築されます。
0.3の完了基準はCombined p95が3秒未満で、すべてのServiceにEvidenceがあること
です。本テストは両方を満たしました。

macOSのUser launchd Domainには数百のRuntime Jobがあります。多くはlaunchdが
LabelとStateだけを公開し、Configured PlistやProgram Pathを提供しないため
Partial Observationです。Apple所有Jobと一時的なApplication Jobは技術調査用に
保持しますがDefaultでは非表示にします。このReference Runでは18件のConfigured
Third-party ServiceがDefault表示に残りました。

同じBenchmarkは次のCommandで実行できます。

```bash
yarn benchmark:services
```

## バージョン0.2 Reference Run

2026年7月27日に記録：

| 項目 | 結果 |
| --- | --- |
| Platform | macOS、Apple Silicon（`arm64`） |
| Runtime | Node.js `v22.22.2` |
| 連続Scan回数 | 20 |
| 最終ScanのListener数 | 30 |
| Partial Observation | 0 |
| Identity Evidence不足 | 0 |
| Source Evidence不足 | 0 |
| Minimum | 67.38 ms |
| Median | 69.78 ms |
| p95 | 78.24 ms |
| Maximum | 100.45 ms |

0.2の完了基準は、通常の開発Workloadでp95が2秒未満であることです。この実行は
基準を満たしました。

ローカルで同じBenchmarkを実行：

```bash
yarn benchmark:scanner
```

BenchmarkはProduction用macOS Scannerで20回の読み取り専用Observationを順番に
実行し、すべてのListenerにIdentityとSource Evidenceがあることを確認してから
Latency統計を出力します。観測したMachine情報を保存またはUploadしません。
