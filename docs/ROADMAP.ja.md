# HostLens Roadmap

[English](ROADMAP.md) | [日本語](ROADMAP.ja.md) | [简体中文](ROADMAP.zh-CN.md)

この Roadmap は日付を固定するものではなく、開発の順序を示します。後半の
Phase は、実際の macOS / Linux 環境で得られる知見に応じて変更できます。

基本となる順序：

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

## リリース済み：0.1.0 — Listening Port を見る

0.1.0 では、最初の実用的な製品を構築しました。

- macOS の TCP Listener をリアルタイムにScan
- PID、Parent PID、User、Command、Executableを中心とした詳細情報
- Local-only / Network-facing 分類
- Process / Port の検索、Sort、Filter
- Menu Bar と通常のApp Window
- English、日本語、简体中文
- 読み取り専用、Local-first Architecture

## リリース済み：0.2.0 — Host Identity and Session Awareness

0.2 が回答する問い：

> **このポートの実体は誰か、どこから起動されたか、今回のHostLens Sessionで
> 何が変わったか？**

0.2は引き続きSingle-hostのPort Inspectorに集中します。同じ信頼できる事実を
個人、Developer、中小企業の情シスに役立てることが目的であり、3つの別Product
を作るものではありません。

### Scanner の信頼性

- PID、PPID、User、Command、Executable、Working Directory の収集改善
- 完全なScanを妨げずに Parent Process Chain を調査
- 収集失敗と権限制限を明示
- macOS Parser Fixture と回帰テストを改善
- Process情報の補完に失敗しても Socket の観測結果を残す

### Process / Project Identity

- Vite、Next.js、React Tooling、Nuxt、webpack などを識別
- Command、Executable、Working Directory、Parent ProcessからProjectを推定
- 生の Process Name とユーザー向け表示名を分離
- 各識別結果の元となる Evidence を保持
- 推論した Identity に Confidence を付ける

### Source Attribution

最初に対応する起動元：

- launchd
- Homebrew Services
- Docker Desktop / Container
- npm、yarn、pnpm の Package Script
- Native macOS Application
- Manual / Unknown

### Session Changes

Databaseを追加せず、次を実装します。

- 前回成功したScanをメモリに保持
- New / Changed / Closed Listener を識別
- App と Menu Bar Quick View に変化を表示
- HostLens 終了時に履歴をReset

### 対象ユーザーに応じた表示

一つのIdentity / Evidence Modelから、情報量の異なる表示を作ります。

- **個人：** 分かりやすい名前、動作している可能性の高い理由、自動起動か、
  Local-onlyかNetwork-facingかを表示し、CommandとEvidenceは展開可能にする
- **Developer：** Project、Tool、Package Script、Working Directory、
  Parent Chain、Runtime、正確なCommandを優先する
- **情シス：** 一貫した技術Identity、Collection Status、Evidence、
  Inventory・Support Ticket・手動確認に使える現在状態Summaryを提供する

0.2で完全なPersona切替Systemは不要です。Friendly SummaryとTechnical Evidence
が同じObjectを参照できることを証明します。

### 共有可能な現在状態Summary

DatabaseやCloud Serviceを使わずに：

- 選択したListenerの現在詳細をCopy / Exportする
- Private PathなどのSensitive Fieldを省略・短縮するSanitized Summaryを用意する
- Collection Time、Identity Confidence、Source、Exposure、Evidenceを含める
- Point-in-time Observationであり、Security Certificationではないと明示する

### 0.2 の実装順序

Vertical Sliceとして順番に実装します。

1. 生のSocket / Process Observationを信頼できる状態にする
2. Identity、Evidence、Confidence、Partial Result Semanticsを導入する
3. Sanitized Fixtureを使ってSource Attribution Resolverを追加する
4. 決定的なIn-memory Session Changesを追加する
5. Friendly / Technical表示とSanitized Current-state Summaryを追加する

前のSliceに必要なShared Modelを迂回して、後のSliceを先に実装しません。

### 0.2 完了条件

Fieldが存在するだけでは完了とみなしません。

- 既存Scanner Testがすべて成功する
- サニタイズされた代表Fixtureが開発ServerとSource Attributionをカバーする
- Reference Macで20回のScan Benchmarkを記録し、通常の開発Workloadで
  p95 Scan Timeが2秒未満である
- 推論したIdentityにEvidenceとConfidenceがある
- Process情報が不足してもSocketを失わずPartial / Unknownとして表示する
- 一般的な開発用MacでScan中もUIが応答する
- 同一Snapshot間のNew / Changed / Closed判定が決定的である
- 非技術ユーザーがRaw Commandを開かなくてもIdentityとExposureを理解できる
- 技術ユーザーがFriendly Identityの根拠Evidenceを確認できる
- Current-state SummaryをPersistenceやBackground Network TrafficなしでCopyできる
- Sanitization Testにより、Private Home-directory PrefixとSecretを含みやすい
  Command ArgumentがSanitized Outputへ含まれないことを示す
- 読み取り専用で、マシン情報をNetworkへ送信しない

2026年7月27日に記録した完了Evidence：

- Scanner Parse、Identity、Source Attribution、Localization、Session Changes、
  Summary Sanitizationを含む36件の自動Testが成功
- Production用Electron BuildとTypeScript Validationが成功
- 実際のmacOS ScanでPackage Script、Native App、Docker、launchd、Unknown
  Sourceを識別し、PartialなSocket Observationも保持
- 実UIでNew / Closedの変化と3言語Interfaceを確認
- 30 Listenerの20回Reference Benchmarkでp95 78.24 msを記録。
  詳細は[Scanner Benchmark](BENCHMARKS.ja.md)

### 0.2 の対象外

- Database / 永続履歴
- UDP Scan
- 完全な macOS Host Inventory
- Linux GUI の同等機能
- Device Discovery、Multi-host Management、Business Hub
- MCP
- LLM / Chat
- Firewall変更
- Process終了
- 自動修復

## 次：Unified Host Model と macOS Inspector

0.2 で Host Identity を検証した後：

- `Process`、`Socket`、`Project`、`LaunchSource`、`Evidence` を正式化
- launchd Service / Startup Item
- Homebrew Services / Docker の関係
- Network Interface、Route、DNS、VPN Context
- Background ActivityとStartup Behaviorを示すPersonal Overview
- Project、Runtime、Local Serviceを示すDeveloper View
- Machine Inventory、Evidence、Reviewable Summaryを示すIT View
- 実際のCollectorとUIがある場合のみResource Typeを追加

## Linux 一等対応

Linux は共通Host概念とPlatform固有Evidenceを利用します。

推奨順序：

1. Process と Listening Socket
2. systemd Service
3. systemd Timer と cron
4. Startup Source Attribution
5. firewalld
6. journal Summary
7. Docker / Podman
8. Package / Runtime Inventory

最初は Ubuntu と Red Hat Enterprise Linux を対象にします。Headless と
Multi-host は別の後期課題です。

## Persistent Changes と Alerts

Identityが安定した後：

- 軽量Snapshotを永続化
- 型付き `ChangeEvent`
- Timeline
- Alert Rule / cooldown
- Desktop Notification
- ユーザーが注目するResource

Alert は Security Verdict を作るのではなく、Evidence と変化を説明します。

## 個人・中小企業向けExperience

Underlying Factを分岐させず、Shared Modelから二つのExperienceを発展させます。

### Personal Host Understanding

- Background ApplicationとStartup Behavior
- 普通の言葉による説明と展開可能なEvidence
- Recent Changes
- Resource / Network Context
- 根拠のないSecurity Claimを避けたAttention Guidance

### 中小企業の情シス

- MacとLinux Hostに共通するInspection
- Current-state InventoryとReviewable Report
- 重要MachineのChanges / Alerts
- Service、Startup、Schedule、Firewall Context
- Local DeploymentとLocal Processing
- Troubleshootingと引き継ぎに使えるEvidence

最初はSingle-host機能として提供し、Enterprise Fleet Managementを前提にしません。

## Local Query API、MCP、Explain

安定した Query Layer は次から共有できます。

- Desktop UI
- 読み取り専用 Local API
- MCP Tool
- 任意の Explain 機能

最初のAI機能は狭く保ちます。

```text
Selected structured object
  ↓
Minimal sanitized JSON
  ↓
External LLM chosen by the user
  ↓
Explanation, implications, and next investigation steps
```

無制限Shell、Free-form Agent、自動Tool実行は含みません。

## 中小企業向けEnvironment Intelligence

Single-host ModelとChangesが信頼できる段階になってから、Office Environmentを
接続します。

- Mac、PC、Linux Server
- NAS / Shared Storage
- Printer
- Router、Switch、Wi-Fi、Local Network Service
- 選択されたCloud Dependency
- Local Business Hub
- Topology / Dependency Relationship
- 集中Changes、Alerts、Reports
- Local-first AI Context

完了条件は「多くのDeviceを一覧表示できる」ことではありません。Office全体の
症状がEndpoint、Shared Service、Network Device、Upstream Dependencyのどれに
起因するかを判断できることです。

## Advisory / Supervised Operations

信頼できるIdentity、Relationship、Snapshot、Evidenceが完成した後：

1. 診断ChecklistとOperations Planを作成
2. Risk、Impact、Verification、Rollbackを表示
3. 承認型の事前定義Operationを追加
4. 操作前後のSnapshotを取得
5. 結果を検証
6. Audit Recordを保持

## Policy Automation と Bounded Autonomy

Supervised Operations の安全性を確認した後、低リスクの自動化を検討します。
各PolicyにはScope、許可Tool、Retry上限、cooldown、失敗時動作、ユーザーOverride
が必要です。

長期的なAgentも必ず境界を持ちます。HostLensをLLMが制御する汎用root Shell
にはしません。

## 関連ドキュメント

- [プロダクト思想](PRODUCT.ja.md)
- [アーキテクチャ](ARCHITECTURE.ja.md)
- [セーフティモデル](SAFETY.ja.md)
- [HostLensをOSSにする理由](OPEN_SOURCE.ja.md)
