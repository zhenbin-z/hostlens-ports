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

## 開発中：0.2.0 — Host Identity

0.2 が回答する問い：

> **このポートの実体は誰か、どこから起動されたか、今回のHostLens Sessionで
> 何が変わったか？**

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

### 0.2 完了条件

Fieldが存在するだけでは完了とみなしません。

- 既存Scanner Testがすべて成功する
- サニタイズされた代表Fixtureが開発ServerとSource Attributionをカバーする
- 推論したIdentityにEvidenceとConfidenceがある
- Process情報が不足してもSocketを失わずPartial / Unknownとして表示する
- 一般的な開発用MacでScan中もUIが応答する
- 同一Snapshot間のNew / Changed / Closed判定が決定的である
- 読み取り専用で、マシン情報をNetworkへ送信しない

### 0.2 の対象外

- Database / 永続履歴
- UDP Scan
- 完全な macOS Host Inventory
- Linux GUI の同等機能
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
- macOS Host Overview
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

## Multi-host

単一Hostで検証されたModelを基盤にします。

- Headless Linux Collector
- 必要に応じた読み取り専用SSH収集
- Host一覧とHost比較
- 集中Changes / Alerts
- Host Scope付きMCP Query
- 個別認可されたRemote Operations

Multi-host Scaleは、優れたSingle-host Inspectorを作る前提条件ではありません。

## 関連ドキュメント

- [プロダクト思想](PRODUCT.ja.md)
- [アーキテクチャ](ARCHITECTURE.ja.md)
- [セーフティモデル](SAFETY.ja.md)

