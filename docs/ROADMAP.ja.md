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

## 開発中：0.3.0 — Services & Startup Inspector

0.3が回答する問い：

> **このMacにはどのServiceとStartup Itemが設定され、現在どれが動作し、
> どのProcessと待受Portがそれらに属するのか？**

### Service Inventory

- 現在のUser launchd DomainからLoadedだがInactiveなJobも収集
- UserおよびLocal Libraryのplistから設定済みThird-party LaunchAgent /
  LaunchDaemonを発見
- Homebrewが利用可能な場合はHomebrew Servicesも収集
- Running Processだけでなく設定済み・停止中のItemも保持
- User Agent、System Agent、System Daemonを区別
- Apple所有System Jobを別分類し、Evidenceを捨てずDefault ViewのNoiseを抑制

### StatusとStartup Behavior

- Running、Loaded、Stopped、Failed、Disabled、Unknownを正規化
- 観測できたPIDとLast Exit Statusを表示
- plist、launchd、Homebrew EvidenceからAutomatic、On demand、Disabled、
  Unknownを推定
- Program、Arguments、plist Path、Label、Manager、Scopeを表示
- plistやCommandを取得できなくてもPartial Objectを保持
- 推論したStatus / Startup PolicyにConfidenceとEvidenceを付与

### Unified Relationship

- `Service`を`Process`、`Socket`、`LaunchSource`とは別ObjectとしてModel化
- ServiceとDirect / Descendant Processを関連付け
- それらProcessが所有するListening Socketを関連付け
- 同一Serviceを表すHomebrewとlaunchd Observationを統合
- 二つ目のIdentity Systemを作らずServiceと関連Portを移動可能にする

### Services Interface

- Full AppとMenu-bar PanelにPorts / Servicesの一等Viewを追加
- Search、Manager、Status、Startup、Scope、Apple-system Filterを提供
- 決定的なSortを提供
- Technical Fieldより先に普通の言葉のService Summaryを表示
- Exact Label、Path、Arguments、Relationship、Confidence、Evidenceを
  Expand可能なTechnical Detailsに表示
- 英語、日本語、簡体字中国語へ対応

### 0.3 完了条件

- Sanitized Fixtureがlaunchctl、plist、Disabled State、Homebrew Outputと
  Malformed / Permission-limited Caseをカバー
- Relationship TestがDirect Process、Descendant、Multiple Socket、
  Stopped Service、Homebrew / launchd Deduplicationをカバー
- 設定済み・停止中Serviceが表示され続ける
- Optional Collector失敗時も他CollectorのPort / Service Factを失わない
- UIがObserved FactとInferred Status / Startup Behaviorを明確に区別
- Default Personal ViewがRaw launchd知識なしで理解できる
- Technical UserがすべてのRelationshipのEvidenceを確認できる
- Reference Development Workloadで20回Benchmarkが応答性を維持
- Production Buildと実macOS UI / Collectorを3言語で確認
- Read-only、Local、Persistent Historyなしを維持し、Machine情報を送信しない

2026年7月28日に`develop/0.3.0` Branchで記録したCompletion Evidence：

- Port / Service Parsing、Permission-limited Partial Object、Status / Startup
  Normalization、Relationship、Deduplication、Optional Collector Failure、
  Filter、Sort、Localizationを含む52件のAutomated Testが成功
- Production Electron BuildとTypeScript Validationが成功
- 実macOS CollectorでConfigured、Running、Loaded、StoppedのThird-party
  Serviceを確認し、Apple / Application Runtime Jobは明示Filterの背後に保持
- 英語、日本語、簡体字中国語の実UI確認、Default Filter、ServiceからRelated
  Portへの移動が成功
- 20回Combined BenchmarkでEvidence不足0件、p95 751.64 msを記録。
  詳細は[Scanner Benchmark](BENCHMARKS.ja.md)

### 0.3 の対象外

- ServiceのStart / Stop / Enable / Disable / Delete
- plist編集
- Persistent History / Alert
- Network Interface、Route、DNS、VPN、Firewall Inspection
- Linux Service Parity
- Privileged / Private APIによるLogin Item管理
- MCP、LLM、Chat
- Multi-host Management

## 計画：0.4.0 — macOS Host Overview & Network Context

0.4は次の問いに答えます。

> **このMacはどのNetworkへ接続し、Listening ServiceはどのInterfaceから到達
> し得るか？**

- `Process`、`Service`、`Socket`、`Project`、`LaunchSource`、
  `NetworkInterface`、`Route`、`DnsConfiguration`、`VpnConnection`、
  `Evidence` のRelationshipを正式化
- macOSのInterface、IPv4 / IPv6 Address、Default Route、DNS Configuration、
  観測可能なVPN Interfaceを収集
- FirewallやInternet Reachabilityを断定せず、Socket Bind Addressを具体的な
  Interfaceへ関連付け
- Bound、Potentially Reachable、Actively Testedを区別
- Current Network、Background Service、Startup Behavior、Network-facing Port、
  Session Changeを示すHost Overview
- Personal向け説明と展開可能なDeveloper / IT Evidence
- Active LAN Scanなし、LocalかつRead-onlyを維持
- 実MacでCollector、Relationship、Performance、3言語UIを検証

## 計画：0.5.0 — Runtimes & Global Packages Inspector

0.5はInstalled Developer ToolingとRunning Stateを関連付けます。

- System、Homebrew、nvm、pyenvなどからNode.js / Python RuntimeをInventory
- npm、Yarn、pnpm、pip、pipxのGlobal PackageをInventory
- Package Name、Version、Manager、Runtime、Install Path、Executableを表示
- Package ExecutableをProcess、Service、Project、Listening Portへ関連付け
- Unknown / Permission-limited ObservationをEvidence付きで保持
- Search、Filter、Summary、Export、英語 / 日本語 / 簡体字中国語UI
- Install、Update、Uninstall、Vulnerability Verdict、Project全Dependency Scanは
  行わない

## 計画：0.6.0 — Persistent Changes & Alerts

Normalized Identityが安定した後：

- Version付きの軽量Local Snapshotを永続化
- Port、Service、Network Context、Runtime / Package Inventory向けの型付き
  `ChangeEvent`
- Retention Control付きの限定Timeline
- ResourceのWatch / Ignore
- Evidence付きAlert Rule、Cooldown、Desktop Notification
- Review可能なCurrent-state / Change Summary
- Tested Migrationを持つLocal Database、Telemetryなし

AlertはSecurity Verdictを作るのではなく、Evidenceと変化を説明します。

## 計画：0.7.0 — Ubuntu / RHEL First-class Support

Linuxは同じHost概念とPlatform固有Evidenceを利用します。

- `ss`と`/proc`によるProcess / Listening Socket
- systemd ServiceとStartup Behavior
- Interface、Route、DNS、VPN Context、firewalld Observation
- 利用可能なDocker / Podman、Runtime、Global Package Inventory
- Relationship、Persistent Change、Alert、Report、3言語UIを再利用
- `.deb`、`.rpm`、実用的なGNOME Desktop Packaging
- Fixtureと代表的な実環境でUbuntu / Red Hat Enterprise Linuxを検証
- Command、権限、Optional Toolが利用できない場合もPartial Resultを保持

Headless Agent、Multi-host、Service Mutation、無制限Shellは後期課題です。

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
