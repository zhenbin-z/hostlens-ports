# HostLens Scanner Benchmark

[English](BENCHMARKS.md) | [日本語](BENCHMARKS.ja.md) | [简体中文](BENCHMARKS.zh-CN.md)

この文書はMarketing上の性能表現ではなく、再現可能なScanner確認結果を記録します。
結果はListener数、実行中のApplication、権限、Storage負荷、OS Versionによって
変化します。

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
