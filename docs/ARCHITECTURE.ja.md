# HostLens アーキテクチャ

[English](ARCHITECTURE.md) | [日本語](ARCHITECTURE.ja.md) | [简体中文](ARCHITECTURE.zh-CN.md)

## アーキテクチャの目的

HostLens は、プラットフォームごとに分散した観測結果を、正規化され
Evidence を持つホストモデルに変換します。

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

UI、将来の MCP Server、将来の LLM 機能は同じ構造化モデルを利用します。
それぞれが独自にコマンド出力を解析してはいけません。

## 各レイヤーの責務

### Collectors

Collector はプラットフォーム上の事実と収集失敗を取得します。

- macOS：`lsof`、`ps`、launchd、Homebrew、ネットワーク設定
- Linux：`/proc`、`ss`、systemd、cron、firewalld、nftables
- コンテナ：Docker / Podman の API とコマンドAdapter

Collector は観測結果の重要度やユーザー向け説明を決定しません。

### Normalizer

Normalizer はプラットフォーム固有の出力を、安定した共通型へ変換します。
権限制限や欠損値は absent または unknown のまま扱い、推測で補完しません。

### Identity Resolver

Identity Resolver は低レベルの観測結果から識別候補を生成します。

```text
process name + command + executable + cwd + parent chain
        ↓
candidate application / runtime / project / launch source
        ↓
confidence and evidence
```

可能な部分は決定的な処理にします。確率的な説明より先に、ルールと構造化された
カタログを利用します。

### Relationship Engine

独立して収集したリソースを関連付けます。

```text
Process listensOn Socket
Process startedBy LaunchSource
Process belongsTo Project
Service launches Process
Container exposes Socket
Package provides Executable
```

### Snapshot and Change Engine

Snapshot は正規化された状態を記録し、比較結果を文章ではなく型付きの変化として
生成します。

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

最初の実装では、HostLens の実行中だけメモリ上で比較できます。永続化は後の
段階で扱います。

### Query and Presentation

Desktop UI、Local API、MCP Tool、Alert、Explain は Host Model を参照します。
表示コードの中に別の識別ロジックを作りません。

### Context Selection

将来のExplanationとExternal Queryには、そのTaskに必要な最小限のFact、
Relationship、Change、Policy、Evidenceだけを渡します。Context Selectionは
単なるLLM最適化ではなく、PrivacyとAccuracyの境界です。

0.2のExportにも同じ原則を適用します。Sanitized Summaryは収集FieldのDumpでは
なく、Host Modelから意図的に選択したProjectionです。

## バージョン0.2の Host Model

0.2 では意図的に小さなモデルから始めます。

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

実装中に正確なTypeScript型は変化できます。ただし Identity、Source、
Confidence、Evidence は別の概念として維持します。

リリース済み0.2では、各Listenerに`ProcessIdentity`と`LaunchSource`を別Field
として保持し、成功した`PortSnapshot`を決定的なメモリ内`SessionChanges`で
包みます。`SessionMonitor`が直前の成功SnapshotとNew / Changed / Closed Eventを
管理します。このSession StateをDiskへ書き込みません。

0.2 が対象とするのは次の概念です。

- `Process`
- `Socket`
- `ProjectIdentity`
- `LaunchSource`
- `Evidence`

`Service`、`FirewallPolicy`、`ScheduledJob`、`Package` などは、実際の
Collector と UI を実装するときに追加します。

## バージョン0.3のService Model

0.3ではCollectorと独立したUIの両方が実装されたため、`Service`を追加します。
ServiceはProcess、Socket、Launch Sourceと同一のObjectとして推測しません。

```text
Configured Plist ─┐
launchctl State ──┼─→ Service ─→ Direct / Descendant Process ─→ Socket
Homebrew State ───┘
```

各ServiceはManager、Label、Kind、Scope、Ownership、正規化したStatus、Startup
Behavior、Program、Arguments、Plist Path、PID、Exit Status、Observationの完全性、
Confidence、Evidenceを保持します。Collector失敗や権限制限があっても、既知の設定を
削除せずPartial Objectとして残します。

RelationshipはEvidence付きIdentifierで表現します。同じPlist Labelを示すHomebrew
とlaunchdのObservationは一つのServiceへ統合します。Apple Jobと一時的なApplication
Runtime JobはModel内に保持しますが、通常の画面ではConfigured Third-party Serviceを
優先するためDefaultで非表示にします。

## バージョン0.5のRuntime / Package Model

0.5ではHostLensをPackage Managerに変えることなく、Runtime Installationと
Package Manager Environmentを追加します。

```text
Runtime installation
  └── Package-manager environment
        └── Package
              └── Provided executable
                    └── Process / Service / Socket
```

`RuntimeInstallation`、`GlobalPackage`、`RuntimeRelationship`は安定したID、
Observationの完全性、利用できないField、Confidence、Evidenceを保持します。
Relationshipは観測可能なExecutableまたはInstall Path Evidenceがある場合だけ
作成し、Package Nameの一致だけでは推論しません。

Node.js Managerは一般的なGlobal Inventoryを提供できます。Pythonには共通の
Global Scopeがないため、pipの結果は各発見Environment内のPackageとして明示します。
Manager不足、Path制限、Command失敗は偽のEmpty Inventoryにせず、WarningとPartial
Resultとして保持します。

Runtime / Package Collectorは60秒のMemory Cacheを利用します。これにより頻繁な
Socket Refreshを軽く保ちます。
Copy / Export Summaryは構造化ModelからのProjectionであり、Sanitized Exportでは
Private Home Pathと一般的なSecret付きArgumentを除去します。

## バージョン0.6のPersistent Change Model

0.6では同じNormalized Host Modelの背後にLocal SQLite Storeを追加します。

```text
HostObservationSnapshot
  → Deterministic Projection
  → Typed ChangeEvent
  → Bounded Local Timeline
  → Watch / Ignore Preference
  → Cooldown付きDesktop Notification
```

最初のObservationをBaselineとし、その後はCollection TimestampとEvidence Timestamp
を除いて比較します。PortはSocket Identity、その他はConfigured Third-party
Service、Active Interface、Default Route、DNS / VPN Context、Runtime、Packageを
Persistent Resourceとします。一時的なApplication JobとDefault以外のRoute変動は
意図的に除外します。

SchemaはVersion管理されMigration Test済みです。Retentionを設定でき、上限は
1,000 Eventと500 Snapshotです。Observation、Preference、Alert Delivery、
SettingはElectronのLocal User-data Directoryに留まり、UploadやAccount作成は
ありません。AlertはTyped Evidenceから生成し、Security Verdictにはしません。

## 将来のモデル

長期的には次のオブジェクトを含む可能性があります。

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

これは方向性であり、早期に空の抽象化を作る要件ではありません。

## 一つのModel、複数のView

異なる真実を作らず、同じ観測事実から複数のExperienceを提供します。

```text
Unified Environment Model
  ├── Personal view
  ├── Developer view
  ├── IT view
  ├── Small-business view
  └── MCP and AI view
```

Viewごとに用語、Default、情報量を変えることができます。Personal Viewでは
「バックグラウンドで自動起動」と表示し、Evidence Viewではlaunchd Labelと
plist Pathを表示できます。どちらも同じObjectとEvidenceを参照します。

## HostからEnvironmentへ

Single-host Inspectionと中小企業向けEnvironment Intelligenceは同じ概念を共有し、
Deployment形態を分けます。

```text
Desktop
local collectors → local model → local UI / query

Small business
host and device collectors → local hub → environment graph
  → business console / alerts / local AI
```

将来のEnvironment Resourceには、PC、Mac、Linux Server、NAS、Printer、
Router、Switch、Wi-Fi Access Point、選択されたCloud Serviceを含められます。

これは0.2へMulti-host Complexityを持ち込む理由ではありません。信頼できる
Single-host Identity Modelが、意味のあるTopologyとCross-device Diagnosisの
前提です。

## ネットワークの意味

HostLens は次を区別しなければなりません。

```text
Bound
Reachable
Allowed
Tested
```

例：

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

非ループバックへの bind は network-facing ですが、LAN やインターネットから
到達できる証明ではありません。

## 失敗と権限の扱い

収集はベストエフォートです。値がない理由として次が考えられます。

- Scan 中にプロセスが終了した
- OS によりアクセスが制限された
- そのプラットフォームでは値が提供されない
- Collector が利用できない
- 解析に失敗した

これらを誤った値に置き換えず、Warning や Evidence 状態として表現します。
管理者権限なしで動作し、情報不足時は安全に縮退します。

## プライバシー境界

コマンド、環境変数、パス、設定ファイルには秘密情報が含まれる可能性があります。

- デフォルトでは環境変数を収集しない
- Renderer に任意のファイル読み取りを公開しない
- 生のコマンド出力を必要以上に保持しない
- Fixture と不具合報告をサニタイズする
- 明示的なユーザー操作なしに外部サービスへホスト情報を送信しない

## Schema の発展

Host Model を公開APIにする前に Schema をバージョン管理できるようにします。
MCP と Local API は、安定した ID、nullability、Evidence の意味、互換性テスト
が揃った後で開始します。
