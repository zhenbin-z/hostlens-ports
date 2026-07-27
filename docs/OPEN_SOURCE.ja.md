# HostLensをOSSにする理由

[English](OPEN_SOURCE.md) | [日本語](OPEN_SOURCE.ja.md) | [简体中文](OPEN_SOURCE.zh-CN.md)

## 信頼には可視性が必要

HostLens は Process、Command、Path、Port、Startup Source、Network情報、
将来的にはDeviceやService間の関係など、機密性のあるローカルContextを扱います。

ユーザーは次を確認できるべきです。

- HostLensが何を収集するか
- どのSystem Interfaceを利用するか
- どの情報がMachine内に残るか
- Networkへ情報を送信するか
- IdentityやWarningがどのように導かれたか
- Operationにどの権限が必要か

Local System Inspectorにとって、Sourceの可視性はTrust Modelの一部です。

## 互換性はCommunityで解決する問題

OSはVersion、Install方法、Package Manager、Hardware、Desktop Environment、
Local Configurationによって異なります。macOS、Ubuntu、RHEL、launchd、
systemd、Homebrew、Docker、開発Toolには、一人のMaintainerだけでは再現できない
Edge Caseがあります。

Open Developmentにより次が可能になります。

- サニタイズされたPlatform固有の不具合報告
- Parser FixtureとCompatibility FixのContribution
- Collector SafetyのReview
- AccessibilityとLocalizationの改善
- Stable Interfaceを利用したIntegration
- MaintainerのMachineだけで正しく動く状態の回避

## 単独でも有用な公開Foundation

Community Foundationは単独でも実用的であるべきです。

- Single-host、Read-only Inspection
- 透明なCollectorとEvidence
- Shared SchemaとFoundational Interface
- Local-first Desktop利用
- Provider-neutralで任意のAI Integration
- Interfaceが成熟した後の安全なRead-only Query / MCP

AIとCloud Serviceは任意のClientであり、Local Machineを理解するための必須条件
ではありません。

## 長く続く公開技術Project

HostLensは使い捨てのDemoや薄いAI Wrapperではなく、長く続く公開Engineering
Projectを目指します。

有用なFoundationをOpenにする理由：

- Systems / Infrastructure Engineeringの品質を示す
- 再利用可能な公開Knowledgeを構築する
- 時間をかけてTrustとReputationを積み上げる
- 同じ問題意識を持つContributorを迎える
- 特定のEmployer、Model Provider、Commercial Product Cycleを超えて継続する

## OSSは将来の全製品公開を意味しない

OSSとしての約束は、このRepositoryでLicenseとともに公開されたCodeに適用され
ます。将来のHostLens Service、Compatibility Pack、Managed Deployment、
Business Coordination、Model、Operations機能すべてを同じPackagingやLicenseで
提供することを意味しません。

将来の境界は実際のProduct需要に従い、明確に文書化します。すでに公開したVersion
の有用性、Privacy Promise、License上の権利を後から弱めてはいけません。

## 現在のLicense

HostLens Portsは現在
[Apache License, Version 2.0](../LICENSE)で公開されています。

Apache-2.0は条件に従った利用、変更、再配布を許可し、明示的なPatent Grantを
含みます。HostLensの名称とLogoは[NOTICE](../NOTICE)で別に扱われ、OSS Code
LicenseはTrademarkの権利を付与しません。

この文書はProjectの意図を説明するもので、法的助言ではありません。

