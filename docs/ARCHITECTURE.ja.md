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
Query, UI, Alerts, MCP, and Explain
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

0.2 が対象とするのは次の概念です。

- `Process`
- `Socket`
- `ProjectIdentity`
- `LaunchSource`
- `Evidence`

`Service`、`FirewallPolicy`、`ScheduledJob`、`Package` などは、実際の
Collector と UI を実装するときに追加します。

## 将来のモデル

長期的には次のオブジェクトを含む可能性があります。

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

これは方向性であり、早期に空の抽象化を作る要件ではありません。

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

