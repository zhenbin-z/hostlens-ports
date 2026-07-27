<div align="center">
  <img src="build/icon.png" width="128" alt="HostLens Ports アイコン">

  # HostLens Ports

  **Macで待受中のポートと、それを開いたプロセスをひと目で確認。**

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-1f7040.svg)](LICENSE)
  ![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)
  ![Built with Electron](https://img.shields.io/badge/Electron-React%20%2B%20TypeScript-47848f.svg)
</div>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/English-6f7d72?style=for-the-badge" alt="English"></a>
  <a href="README.ja.md"><img src="https://img.shields.io/badge/日本語-1f7040?style=for-the-badge" alt="日本語"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/简体中文-6f7d72?style=for-the-badge" alt="简体中文"></a>
</p>

HostLens Portsは、`lsof`、`netstat`、`ss`などのコマンドを覚えなくても、
TCP待受ポートを確認できる軽量なオープンソースのデスクトップツールです。
ポートとプロセス、コマンド、バインドアドレス、ネットワーク公開範囲を関連付け、
検索しやすい画面にまとめます。

現在のリリースは、ローカル専用かつ読み取り専用です。LLM、データベース、
テレメトリー、アカウント、クラウドサービスは使用しません。

![HostLens Ports アプリ](docs/images/hostlens-ports-app.png)

## 主な機能

- macOS上のTCP待受ポートをリアルタイムに検出
- プロセス、PID、親PID、ユーザー、完全なコマンドを表示
- `Vite · project-name`や`Docker Desktop Service`など分かりやすい名称
- ポート、プロセス、プロジェクト、アドレス、コマンドで検索
- ポート範囲、プロセス所有元、公開範囲で絞り込み
- ポート、プロセス名、所有元、公開範囲で並べ替え
- ローカル専用とネットワーク公開中のポートを区別
- メニューバーのクイックビューと完全なデスクトップ画面
- 英語、日本語、簡体字中国語のUI
- 完全表示およびコピー可能なコマンド詳細
- 管理者権限を要求しない読み取り専用動作
- 将来のLinux対応に向けたプラットフォーム抽象化

<p align="center">
  <img src="docs/images/hostlens-ports-quick-view.png"
       width="430"
       alt="HostLens Ports メニューバー クイックビュー">
</p>

## クイックスタート

### 必要環境

- macOS
- Node.js 22以降
- Yarn Classic 1.22

### 開発モードで実行

```bash
git clone https://github.com/zhenbin-z/hostlens-ports.git
cd hostlens-ports
yarn install
yarn dev
```

開発用レンダラーはポート`5190`を使用します。Electronは通常のアプリ画面を開き、
Dockとメニューバーの両方からHostLens Portsを利用できる状態にします。

## 表示内容の見方

HostLensでは、次の3つを別々の概念として扱います。

| 分類 | 値 | 意味 |
| --- | --- | --- |
| ポート範囲 | システム、サービス、動的 | ポート番号の範囲 |
| 所有元 | システム、サービス、アプリ、開発、不明 | プロセスの推定分類 |
| 公開範囲 | ローカルのみ、ネットワーク公開、不明 | ソケットが待受するインターフェース |

ポート番号の範囲は次のとおりです。

- **システム：** `0–1023`
- **サービス：** `1024–49151`
- **動的：** `49152–65535`

「ネットワーク公開」は、非ループバックアドレスまたは全インターフェースに
バインドされていることを示します。ファイアウォール、ルーター、VPN、
インターネット経由で実際に到達できることを保証するものではありません。

プロセス分類と表示名は、実行ファイルのパス、コマンド、App Bundle、
プロジェクトディレクトリから推定します。HostLensは根拠として元の
プロセス名とコマンドを常に表示します。

## プライバシーとセキュリティ

HostLens Portsは次の方針で動作します。

- すべてローカルで実行
- ポート調査はElectronのメインプロセスだけで実行
- Rendererには小さく型付けされたAPIだけを公開
- マシン情報を外部へ送信しない
- プロセス、サービス、ファイアウォール、ソケットを変更しない
- 管理者権限を要求しない

権限を昇格しないため、一部のシステムプロセスでは情報が不足する場合があります。
HostLensは広い権限を要求せず、不足する情報を「不明」として扱います。

## 対応状況

| プラットフォーム | 状況 |
| --- | --- |
| macOS | 対応済み：`lsof`と`ps`によるライブスキャン |
| Ubuntu | 対応予定 |
| Red Hat Enterprise Linux | 対応予定 |

## 開発コマンド

```bash
yarn dev        # 開発モードでElectronを起動
yarn typecheck  # TypeScriptの型チェック
yarn test       # スキャナーとプロセス識別のテスト
yarn build      # プロダクションビルドを作成
yarn dist:mac   # 署名なしのローカル.dmgと.zipを作成
```

## コントリビューション

IssueとPull Requestを歓迎します。変更を送る前に
[CONTRIBUTING.md](CONTRIBUTING.md)をお読みください。

ポートとプロセスの関連付けに誤りがある場合は、OSバージョンと再現可能な
匿名化済みコマンド出力を添えてください。秘密情報、顧客名、ユーザー名、
プライベートなファイルパスは投稿しないでください。

## ライセンス

HostLens Portsは[Apache License, Version 2.0](LICENSE)で公開されています。

Copyright 2026 Zhenbin Zhang. HostLensの名称とロゴはZhenbin Zhangの商標です。
表示と商標に関する情報は[NOTICE](NOTICE)をご覧ください。
