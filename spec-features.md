# ロボコン会場向け WiFi 運用支援アプリ 仕様書

## 1. 概要

### 1.1 目的

本アプリは、ロボコン会場における各チームの WiFi 運用を支援することを目的とする。主な目的は以下の通り。

* 各チームが使用する WiFi 構成を登録・共有できること
* 2.4GHz / 5GHz / 6GHz のチャンネル利用状況を可視化できること
* 運営が観測した野良 WiFi を取り込み、会場全体の混雑状況を把握できること
* 実際の通信不良事例を低負荷で報告・共有できること
* 過去の報告や一般的知見をもとにベストプラクティスを提示できること
* オフライン環境でも利用でき、オンライン復帰時に同期できること
* 大学向けに、ユーザー登録を最小限に抑えて利用できること

### 1.2 想定利用者

* **運営者**: 大会全体のチャンネル利用状況管理、野良 WiFi の投入、注意喚起の発信を行う
* **チーム編集者**: 自チームの WiFi 構成登録、不具合報告、会場状況の確認を行う
* **一般閲覧者**: 会場の公開情報やベストプラクティスを閲覧する

### 1.3 スコープ

本仕様書では以下を定義する。

* 画面仕様
* データモデル
* 操作フロー

ネットワーク機器の自動制御、実機への設定書き込み、リアルタイム電波測定の自動収集は本スコープ外とする。ただし将来拡張を妨げない設計とする。

---

# 2. 画面仕様

## 2.1 画面一覧

1. 大会トップ画面
2. チャンネルマップ画面
3. チーム一覧画面
4. チーム詳細・編集画面
5. WiFi 構成編集画面
6. 機材仕様管理画面
7. 不具合報告画面
8. 報告詳細画面
9. ベストプラクティス画面
10. 野良 WiFi 取込画面（運営向け）
11. 同期状態確認画面
12. 運営ダッシュボード画面

---

## 2.2 大会トップ画面

### 目的

大会全体の概要、帯域別の利用状況、参加入口を提示する。

### 主な表示項目

* 大会名
* 会場名
* 開催日
* 現在の同期状態
* 帯域別サマリ

  * 2.4GHz の登録数
  * 5GHz の登録数
  * 6GHz の登録数
  * 報告件数
* お知らせ / 注意喚起
* チーム用アクセスリンク案内

### 主な操作

* チャンネルマップへ遷移
* ベストプラクティスへ遷移
* 自チーム画面へ遷移
* 同期状態確認へ遷移

### 備考

未認証状態でも閲覧可能な範囲を設ける。編集系操作はチーム用リンクまたは運営権限が必要。

---

## 2.3 チャンネルマップ画面

### 目的

帯域ごとのチャンネル占有状況を可視化する。

### 表示単位

* タブ切替: 2.4GHz / 5GHz / 6GHz

### 主な表示項目

* チャンネル軸
* 各 WiFi 構成の占有バー

  * チーム名
  * 構成名
  * 用途
  * チャンネル番号
  * チャンネル幅
  * 機材型番
  * 報告件数
* 野良 WiFi の占有バー
* 問題報告ありの強調表示
* 凡例

### 表示ルール

* バーの中心は中心チャンネルに対応する
* バーの長さはチャンネル幅に応じて変化する
* 自チームは強調色で表示する
* 野良 WiFi はグレー系で表示する
* 不具合報告が閾値を超える場合は警告表示を行う

### フィルタ

* 自チームのみ
* 野良 WiFi のみ
* 制御用途のみ
* 問題報告ありのみ
* 帯域幅で絞り込み
* 型番で絞り込み

### 主な操作

* バーを選択して詳細を表示
* フィルタの変更
* 報告作成画面へ遷移
* ベストプラクティス参照

---

## 2.4 チーム一覧画面

### 目的

大会参加チームの一覧と利用状況を確認する。

### 主な表示項目

* チーム名
* 学校名
* ピット番号
* 使用中構成数
* 不具合報告件数
* 最終更新日時

### 主な操作

* チーム詳細画面へ遷移
* 並び替え
* 検索

---

## 2.5 チーム詳細・編集画面

### 目的

自チームの基本情報と WiFi 構成を確認・編集する。

### 主な表示項目

* チーム名
* 学校名
* ピット番号
* 代表メールアドレス
* 利用中 WiFi 構成一覧（最大 3 件）
* 使用機材一覧
* 最近の報告一覧
* 同期状態

### 主な操作

* 基本情報編集
* WiFi 構成追加 / 編集 / 無効化
* 機材仕様編集
* 報告作成
* 編集リンク再送申請（運営権限または所定手続き）

### 入力制約

* WiFi 構成は最大 3 件まで
* 必須項目未入力時は保存不可

---

## 2.6 WiFi 構成編集画面

### 目的

WiFi 構成の詳細を登録する。

### 主な入力項目

* 構成名
* 用途

  * 制御
  * 映像
  * デバッグ
  * その他
* 周波数帯

  * 2.4GHz
  * 5GHz
  * 6GHz
* チャンネル番号
* チャンネル幅
* 主系 / 予備系
* 状態

  * 使用中
  * 予備
  * 無効
* AP 機材
* クライアント機材
* 想定距離カテゴリ

  * 近い
  * 中距離
  * 遠い
* Ping 送信先 IP
* 備考

### 主な操作

* 保存
* 下書き保存
* 削除または無効化

### 補助表示

* 同帯域の現在利用状況
* 推奨上の注意
* 既知の機材相性注意

---

## 2.7 機材仕様管理画面

### 目的

WiFi 関連機材の仕様を登録し、報告時の自動補完に利用する。

### 主な入力項目

* メーカー
* 型番
* 種別

  * AP
  * クライアント
  * USB ドングル
  * ルータ
  * ブリッジ
  * その他
* 対応帯域
* 備考
* 既知の注意点

### 主な操作

* 追加
* 編集
* アーカイブ

---

## 2.8 不具合報告画面

### 目的

大会中でも短時間で不具合を報告できるようにする。

### モード

* 簡易モード
* 詳細モード

### 簡易モードの表示・入力項目

#### 自動補完

* チーム名
* WiFi 構成名
* 使用帯域
* チャンネル
* チャンネル幅
* AP 型番
* クライアント型番

#### 利用者入力

* 症状分類
* 深刻度
* Ping 状態または平均 Ping
* パケットロス率（任意）
* 距離カテゴリ
* 一言メモ

### 詳細モード追加項目

* 最大 Ping
* 推定距離[m]
* 観測位置
* 再現性
* 対処内容
* 改善有無
* 添付ファイル
* 自由記述

### 主な操作

* ローカル保存
* 送信
* 下書き化
* 詳細モード展開

### 備考

オフライン時は pending 状態として端末保存し、後で同期する。

---

## 2.9 報告詳細画面

### 目的

報告内容を確認し、必要に応じて追記する。

### 表示項目

* 報告日時
* チーム名
* WiFi 構成
* 機材情報
* メトリクス
* 症状
* 距離情報
* 対処内容
* 添付
* 同期状態

### 主な操作

* 追記編集
* 同期再試行
* 類似報告参照

---

## 2.10 ベストプラクティス画面

### 目的

一般知識と会場固有知見を提示する。

### 表示項目

* 一般的推奨
* 会場固有の注意
* 型番固有の注意
* 過去報告からの傾向
* 推奨構成例

### 主な操作

* 帯域別閲覧
* 用途別閲覧
* 型番検索

---

## 2.11 野良 WiFi 取込画面（運営向け）

### 目的

運営が観測した野良 WiFi を登録する。

### 入力方法

* 手入力
* CSV インポート

### 入力項目

* SSID
* BSSID
* 帯域
* チャンネル
* チャンネル幅
* RSSI
* 観測位置
* 観測時刻
* 備考

### 主な操作

* 一括取込
* 個別編集
* 削除または無効化

---

## 2.12 同期状態確認画面

### 目的

オフライン保存データと同期状況を確認する。

### 表示項目

* 未同期件数
* 同期失敗件数
* 最終同期日時
* 同期対象一覧

### 主な操作

* 手動同期
* 失敗データ再送
* 競合確認

---

## 2.13 運営ダッシュボード画面

### 目的

大会全体の状況を把握し、必要な対応を行う。

### 表示項目

* 登録チーム数
* 帯域別構成数
* 野良 WiFi 観測件数
* 不具合報告件数
* 高深刻度報告一覧
* 最近の更新

### 主な操作

* 注意喚起作成
* ベストプラクティス更新
* チーム編集リンク再送
* 野良 WiFi 取込

---

# 3. データモデル

## 3.1 設計方針

* 報告時の入力負担を軽減するため、チーム・機材・WiFi 構成を事前登録可能とする
* オフライン対応のため、各レコードはクライアント側一時 ID と同期状態を持てる設計とする
* 将来の集計や推奨生成を考慮し、報告にはメトリクスと対処結果を記録可能とする

---

## 3.2 エンティティ一覧

* Tournament
* Team
* TeamAccess
* DeviceSpec
* WifiConfig
* ObservedWifi
* IssueReport
* BestPractice
* SyncRecord
* Notice

---

## 3.3 Tournament

### 用途

大会単位の情報を保持する。

### 属性

* id: string
* name: string
* venueName: string
* startDate: string
* endDate: string
* description?: string
* createdAt: string
* updatedAt: string

---

## 3.4 Team

### 用途

参加チームの基本情報を保持する。

### 属性

* id: string
* tournamentId: string
* name: string
* organization?: string
* pitId?: string
* contactEmail?: string
* displayContactName?: string
* notes?: string
* createdAt: string
* updatedAt: string

### 制約

* tournamentId + name の重複は避ける

---

## 3.5 TeamAccess

### 用途

チーム編集用の長期リンク管理を行う。

### 属性

* id: string
* teamId: string
* email: string
* accessTokenHash: string
* issuedAt: string
* lastUsedAt?: string
* revokedAt?: string
* role: "editor" | "viewer"

### 備考

* トークン本体は保存しない
* 再発行時は旧トークンを失効させる

---

## 3.6 DeviceSpec

### 用途

機材仕様を保持する。

### 属性

* id: string
* teamId: string
* vendor?: string
* model: string
* kind: "ap" | "client" | "usb_dongle" | "router" | "bridge" | "other"
* supportedBands: ("2.4GHz" | "5GHz" | "6GHz")[]
* notes?: string
* knownIssues?: string
* createdAt: string
* updatedAt: string

---

## 3.7 WifiConfig

### 用途

チームごとの WiFi 構成を保持する。

### 属性

* id: string
* teamId: string
* name: string
* purpose: "control" | "video" | "debug" | "other"
* band: "2.4GHz" | "5GHz" | "6GHz"
* channel: number
* channelWidthMHz: 20 | 40 | 80 | 160
* role: "primary" | "backup"
* status: "active" | "standby" | "disabled"
* apDeviceId?: string
* clientDeviceId?: string
* expectedDistanceCategory?: "near" | "mid" | "far"
* pingTargetIp?: string
* notes?: string
* createdAt: string
* updatedAt: string

### 制約

* 1 チームあたり active / standby を含め最大 3 件まで

---

## 3.8 ObservedWifi

### 用途

野良 WiFi または運営観測 WiFi を保持する。

### 属性

* id: string
* tournamentId: string
* source: "wild" | "analyzer_import" | "manual"
* ssid?: string
* bssid?: string
* band: "2.4GHz" | "5GHz" | "6GHz"
* channel: number
* channelWidthMHz?: number
* rssi?: number
* locationLabel?: string
* observedAt: string
* notes?: string
* createdAt: string
* updatedAt: string

---

## 3.9 IssueReport

### 用途

通信不良の報告を保持する。

### 属性

* id: string
* tournamentId: string
* teamId?: string
* wifiConfigId?: string
* reporterName?: string
* createdAt: string
* updatedAt: string
* syncStatus: "local_only" | "pending" | "synced" | "failed"
* band: "2.4GHz" | "5GHz" | "6GHz"
* channel: number
* channelWidthMHz?: number
* symptom: "cannot_connect" | "unstable" | "low_throughput" | "high_latency" | "disconnect" | "distance_sensitive" | "unknown"
* severity: "low" | "medium" | "high" | "critical"
* avgPingMs?: number
* maxPingMs?: number
* packetLossPercent?: number
* distanceCategory?: "near" | "mid" | "far" | "obstacle"
* estimatedDistanceMeters?: number
* locationLabel?: string
* reproducibility?: "always" | "sometimes" | "once"
* description?: string
* mitigationTried?: ("change_channel" | "change_width" | "change_band" | "change_device" | "move_position" | "none")[]
* improved?: boolean
* apDeviceModel?: string
* clientDeviceModel?: string

### 備考

wifiConfigId がある場合、帯域・チャンネル・幅・機材型番は初期値として自動補完される。

---

## 3.10 BestPractice

### 用途

一般知識または大会固有知見を保持する。

### 属性

* id: string
* tournamentId?: string
* title: string
* body: string
* scope: "general" | "tournament" | "band" | "device"
* targetBand?: "2.4GHz" | "5GHz" | "6GHz"
* targetModel?: string
* createdAt: string
* updatedAt: string

---

## 3.11 Notice

### 用途

運営からのお知らせを保持する。

### 属性

* id: string
* tournamentId: string
* title: string
* body: string
* severity: "info" | "warning" | "critical"
* publishedAt: string
* expiresAt?: string

---

## 3.12 SyncRecord

### 用途

同期対象の状態を追跡する。

### 属性

* id: string
* entityType: string
* entityId: string
* action: "create" | "update" | "delete"
* status: "pending" | "processing" | "failed" | "done"
* errorMessage?: string
* createdAt: string
* updatedAt: string

---

## 3.13 エンティティ関連

* Tournament 1 - N Team
* Team 1 - N DeviceSpec
* Team 1 - N WifiConfig
* Team 1 - N TeamAccess
* Tournament 1 - N ObservedWifi
* Tournament 1 - N IssueReport
* Tournament 1 - N BestPractice
* Tournament 1 - N Notice

---

# 4. 操作フロー

## 4.1 チーム参加フロー

### 前提

運営がチームの代表メールアドレスを把握している。

### 手順

1. 運営が Team を作成する
2. 運営が TeamAccess を発行する
3. 代表メールアドレスに長期有効リンクを送信する
4. チーム編集者がリンクを開く
5. チーム詳細画面へ遷移する

### 期待結果

* ユーザー登録なしで自チーム編集権限を獲得できる
* 次回以降も同リンクで再入場できる

### 例外

* リンク失効済みの場合は再発行案内を表示する
* 権限不足の場合は閲覧モードに制限する

---

## 4.2 初期設定フロー

### 手順

1. チーム編集者が基本情報を確認する
2. 機材仕様を登録する
3. WiFi 構成を最大 3 件まで登録する
4. 保存する
5. チャンネルマップで表示を確認する

### 期待結果

* 報告時の自動補完に必要な情報が揃う
* チーム構成が会場全体の図に反映される

---

## 4.3 WiFi 構成更新フロー

### 手順

1. チーム詳細画面から対象構成を選択する
2. チャンネル、幅、状態などを変更する
3. 保存する
4. オンライン時は即時反映、オフライン時は pending として保持する
5. 同期後、チャンネルマップへ反映する

### 期待結果

* 当日の変更が追跡可能である
* マップ表示が最新状態に更新される

---

## 4.4 不具合の簡易報告フロー

### 手順

1. ユーザーが自チーム画面またはチャンネルマップから報告開始する
2. WiFi 構成を選択する
3. 自動補完内容を確認する
4. 症状、深刻度、Ping、距離カテゴリを入力する
5. 必要に応じて一言メモを入力する
6. 送信またはローカル保存する

### 期待結果

* 大会中でも短時間で報告可能である
* 必須入力が最小限に抑えられる

### 入力最小化方針

* 事前登録済みの項目は原則自動補完
* 自由入力は任意項目を中心とする

---

## 4.5 不具合の詳細追記フロー

### 手順

1. 報告詳細画面を開く
2. 最大 Ping、推定距離、対処内容、改善有無、自由記述などを追記する
3. 保存する
4. 同期可能ならサーバへ送信する

### 期待結果

* 後から分析可能な知見を蓄積できる

---

## 4.6 オフライン保存・同期フロー

### 手順

1. 端末がオフライン状態であることを検知する
2. 作成・更新内容をローカル DB に保存する
3. SyncRecord を pending で作成する
4. オンライン復帰時に自動同期または手動同期を行う
5. 成功時は synced / done に更新する
6. 失敗時は failed に更新し、再試行可能にする

### 期待結果

* 通信不良時でも入力データが失われない
* 復旧後に一括反映できる

### 競合時の扱い

* 最初の実装では単純な最終更新優先を採用してよい
* 重要項目競合時は警告表示を行う

---

## 4.7 野良 WiFi 取込フロー

### 手順

1. 運営が取込画面を開く
2. 手入力または CSV インポートを選ぶ
3. データを確認する
4. 取込を実行する
5. チャンネルマップに反映する

### 期待結果

* 会場全体の混雑状況に外部要因を反映できる

---

## 4.8 ベストプラクティス閲覧フロー

### 手順

1. ユーザーがベストプラクティス画面を開く
2. 帯域や用途でフィルタする
3. 一般推奨、会場固有推奨、型番別注意を参照する
4. 必要に応じてチーム構成見直しや報告投稿へ移動する

### 期待結果

* 利用者が運用判断の参考情報を得られる

---

## 4.9 運営による注意喚起フロー

### 手順

1. 運営がダッシュボードで高深刻度報告や混雑状況を確認する
2. 必要に応じて Notice を作成する
3. 大会トップおよび関連画面に表示する

### 期待結果

* チームへ迅速に注意を共有できる

---

# 5. 非機能要件

## 5.1 利用環境

* PC およびスマートフォンの Web ブラウザで利用可能であること
* PWA として動作可能であることが望ましい

## 5.2 オフライン対応

* 主要な閲覧画面および報告作成画面はオフライン利用可能とする
* 作成・更新内容は端末内に永続保存する

## 5.3 性能

* チャンネルマップ画面は、数十チーム規模・数百件規模の観測データで実用的な応答時間を維持すること

## 5.4 セキュリティ

* チーム編集リンクは十分長いランダムトークンを用いること
* サーバにはトークンのハッシュのみを保存すること
* 失効・再発行が可能であること

## 5.5 監査性

* WiFi 構成変更、不具合報告作成、重要なお知らせ作成について時刻を記録すること

---

# 6. 今後の拡張候補

* 位置情報を考慮した混雑推定
* 類似報告自動提案
* 型番別安定度集計
* 推奨チャンネルのスコアリング表示
* Analyzer アプリの JSON 直接取込
* 複数会場テンプレート対応

---

# 7. MVP 範囲

初期実装では以下を MVP とする。

* チーム編集リンク方式による参加
* チーム基本情報登録
* 機材仕様登録
* WiFi 構成登録（最大 3 件）
* 帯域別チャンネルマップ表示
* 野良 WiFi の手入力・CSV 取込
* 不具合の簡易報告
* オフライン保存と後同期
* ベストプラクティス表示

以上。
