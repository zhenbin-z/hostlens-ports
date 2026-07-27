# HostLens プロダクト思想

[English](PRODUCT.md) | [日本語](PRODUCT.ja.md) | [简体中文](PRODUCT.zh-CN.md)

## ビジョン

HostLens は、人にとって分かりやすいシステムインスペクターであり、OS
に関するナレッジレイヤーです。

次のことを説明できるようにすることが目的です。

- マシン上で何が実行されているか
- なぜ実行されているか
- どのように起動されたか
- どのプロジェクト、アプリ、サービス、コンテナ、パッケージに属するか
- どのポートやリソースを使用しているか
- リソース同士がどのように関係しているか
- 最近何が変化したか

短いプロダクトメッセージは次のとおりです。

> **Understand what is really running on your machine.**  
> 自分のマシンで本当に動いているものを理解する。

HostLens はインスペクターから始まります。ホスト状態を確実に観測、識別、
関連付け、説明できるようになった後で、境界を持つ運用 Agent へ発展できます。

## プロダクト原則

### 操作より先に情報を整える

初期段階のプロダクトループは次のとおりです。

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

システムを制御しようとする前に、まず理解しなければなりません。

### 構造化された事実が中核資産

`lsof`、`ps`、`launchctl`、`systemctl` や LLM を呼び出せること自体が
HostLens の価値ではありません。それらの情報源から、正規化され、検索可能な
Host Model を構築することが持続的な価値です。

生の観測結果：

```text
node
PID 1234
127.0.0.1:5173
```

有用なホスト識別情報：

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

### コマンド出力画面ではなく関係を示す

HostLens は次のような関係をモデル化します。

```text
Project
  ↓ defines
package script
  ↓ launches
Process
  ↓ listens on
Socket
```

互いに無関係なOSコマンドのGUI集にしてはいけません。

### 事実、推論、不明を区別する

重要な結論では、次の内容を明確にします。

- 直接観測した内容
- 推論した内容
- 推論の確度
- まだ不明な内容

ベストエフォートの識別結果を、裏付けのない事実として表示してはいけません。

### AIがなくても有用であること

基本インスペクターは LLM なしでも有用でなければなりません。AI はユーザーが
明示的に選択した構造化情報を説明できますが、基本的な製品価値を AI に依存
させません。

### プライバシー優先

ホスト情報にはユーザー名、パス、プロジェクト名、コマンド、ネットワーク
アドレス、秘密情報が含まれる可能性があります。データ収集はデフォルトで
ローカルに限定します。将来外部AIを利用する場合は、送信する構造化情報を
最小化し、ユーザーに明示します。

## HostLens の対象ユーザー

HostLens は一つの Evidence-backed Environment Model を維持し、ユーザーに
応じて異なる View と言葉で表示します。

### 個人ユーザー

個人ユーザーが知りたいのはOS用語ではなく結果です。

- バックグラウンドで何が動いているか
- なぜこのAppが自動起動するか
- 最近何が変わったか
- Memory、Storage、Battery、Networkを何が使用しているか
- Network-facing Processは意図したものか

通常は分かりやすい言葉で表示し、確認したいユーザーには一段深い技術的Evidence
を提供します。

### 開発者

開発者には正確なローカル関係が必要です。

- Socket、Process、Parent Process、Command、Working Directory
- launchd、Homebrew、Docker、Development Server
- Runtime、Project、Package Script、Configuration
- Local Network Exposure と Source Attribution

HostLens Ports はこのPersona向けの最初の具体的なProductです。

### 中小企業の情シス

経営者、兼任管理者、少人数の情シスには、Enterprise向け監視Stackを導入せずに
信頼できる回答が必要です。

- 重要な各マシンにどのServiceとStartup Itemが存在するか
- 前回確認時から何が変わったか
- 共有Printer、NAS、Server、Local Applicationがなぜ利用できないか
- オフィス全体の問題がどのMachineやDependencyに起因するか
- 何を確認すべきで、何が通常動作か
- 確認可能なInventoryやReportをどう作るか

長期的には、Single HostからPC、Mac、Linux Server、NAS、Printer、Router、
Wi-Fi、選択されたCloud DependencyまでをLocal-firstで理解できるようにします。

### AI と外部Tool

外部Assistantには、現在の事実を安全に取得できる安定した情報源が必要です。
読み取り専用QueryとMCPは、任意Shellを許可せず、必要な構造化Contextだけを
提供します。

## HostLens とは

- ホスト情報インスペクター
- 開発者向けのプロセス・サービス説明ツール
- 正規化されたOSデータレイヤー
- ホスト識別情報と関係のローカルな信頼できる情報源
- 状態変化を把握するツール
- 個人と中小企業がDigital Environmentを理解するための基盤
- 将来の読み取り専用APIおよびMCP Server
- 将来的には監督・ポリシー制約付きの運用システム

## HostLens ではないもの

少なくとも初期段階では、次の製品ではありません。

- アンチウイルス
- EDR
- 脆弱性スキャナー
- ディスククリーナー
- 自動システム最適化ツール
- マルウェア判定エンジン
- 無制限の Shell Agent
- デフォルトで root 権限を要求する自律プログラム

セキュリティに関する表示では、次の形式を優先します。

```text
Observation
Evidence
Possible implication
Recommended investigation
```

根拠がない状態で、次のように断定しません。

```text
Malicious
Dangerous
Safe to delete
```

## プラットフォーム方針

最初の対象環境は macOS です。Linux は付随的な移植先ではなく、一等対応
プラットフォームです。Ubuntu と Red Hat Enterprise Linux では、
プラットフォーム固有の Collector と Evidence を維持しながら、共通の
正規化された概念を使用します。

Windows は Host Model と Collector の境界が安定した後に検討します。

## 成功基準

HostLens の成功とは、次のことができる状態です。

- リソースを正確に識別する
- 識別の根拠を説明する
- プロセス、Socket、サービス、プロジェクト、起動元を関連付ける
- 事実と推論を区別する
- 不必要な不安を生まずに変化を説明する
- LLM なしでも有用である
- 将来のクライアントに安定した構造化データを提供する
- 検証可能な運用計画を提示する
- 明確な権限範囲内でのみ安全に操作する

対応コマンド数や機能数そのものは成功指標ではありません。
