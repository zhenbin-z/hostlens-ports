# HostLens セーフティモデル

[English](SAFETY.md) | [日本語](SAFETY.ja.md) | [简体中文](SAFETY.zh-CN.md)

## 原則

HostLens が持つ権限は、理解能力よりもゆっくり拡大させます。

安全な長期的発展は次のとおりです。

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

各Levelは、前のLevelで得た信頼性、Evidence、監査可能性に依存します。

## Level 0：Inspector

HostLens はホスト状態を収集・表示します。

- 読み取り専用
- LLM に Shell を提供しない
- プロセス、サービス、Firewall、ファイルを変更しない
- 結論には Evidence を付ける
- 不明な内容を明示する

現在の製品はこのLevelです。

## Level 1：Explainer

ルールと任意の LLM が、選択された構造化オブジェクトを説明します。

- なぜこのポートが開いているか
- このプロセスは何か
- なぜこのサービスは起動時に実行されるか
- 今回のSessionで何が変わったか

LLM に渡すのは選択された構造化データであり、マシンへの自由なアクセスでは
ありません。コマンドの実行はできません。

## Level 2：Advisor

HostLens は操作を実行せず、運用計画を提案できます。

各計画に必要な内容：

- 観測された問題
- 根拠となる Evidence
- 提案する手順
- リスクと予想される影響
- 結果の検証方法
- 必要に応じた Rollback 方法

## Level 3：Supervised Operator

ユーザーが明示的に承認した後、事前定義された操作を実行できます。

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

無制限の Shell Tool は提供しません。各操作は型付きの対象と検証済みの引数を
持ちます。

## Level 4：Policy Automation

ユーザーは明確で低リスクな操作を、明示的なルールのもとで許可できます。

各Policyに必要な内容：

- リソース範囲
- 許可された操作
- 事前条件
- 最大試行回数
- cooldown
- 必要に応じた実行時間帯
- 失敗時とエスカレーション時の動作
- すぐに無効化できる仕組み

## Level 5：Bounded Autonomous Agent

Agent は、明示的に許可された境界内でのみ、観測、診断、計画、実行、検証、
エスカレーションを行えます。

境界の例：

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

root 権限を持つこと自体を、操作の承認とはみなしません。

## Operations Engine の要件

将来の書き込み能力は LLM Prompt ではなく、Operations Engine に実装します。

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

操作は次の条件を満たします。

- 事前定義されている
- 引数の範囲が狭く型付けされている
- Platform と Resource ごとに Allowlist 管理される
- 個別に承認される
- 操作前後を観測できる
- 再試行可能性が明示される
- Audit Log に記録される

## LLM の境界

LLM が行えること：

- ユーザー意図の理解
- 読み取り専用の構造化Queryの選択
- Evidence の説明
- 変化の要約
- 診断Checklistの作成
- 運用計画の提案

デフォルトで許可しないこと：

- 任意の Shell 実行
- 任意のファイル読み取り
- 管理者権限の取得
- プロセス終了
- 起動設定の変更
- Firewall Policy の変更
- プロセス名だけによるマルウェア判定
- 未確認のマシン情報を外部Providerへ送信

## Evidence と表現

安全性は表示方法にも関係します。

```text
New network-facing listener observed
```

と表示し、明確なPolicyとEvidenceがない限り、

```text
Dangerous port detected
```

とは断定しません。

## Operations 開発を始める前提条件

Supervised Operations を始めるには、次が必要です。

- 安定した Resource ID
- 信頼できる収集と Source Attribution
- Snapshot と型付きChange
- 決定的な Operation Definition
- 権限と承認フロー
- 操作前後の条件確認
- Audit保存
- 失敗処理
- 危険な操作が承認を迂回できないことを示すTest

