# ロボコン会場向け WiFi 運用支援アプリ 技術選定

## 1. 方針

`spec-features.md` の MVP を最短で安全に実装するため、バックエンドとフロントエンドは明確に分離しつつ、TypeScript の型・スキーマ・テストを共有できるモノレポ構成を採用する。

特に重視することは以下。

* 大会中の通信不良を前提に、主要入力をオフラインでも失わないこと
* チーム利用者にユーザー登録を要求せず、編集リンクで迷わず参加できること
* 運営操作、CSV 取込、同期処理などで不整合を起こしにくいこと
* MVP 後に推奨チャンネル算出、類似報告、Analyzer JSON 取込へ拡張できること

## 2. 全体構成

### 2.1 リポジトリ構成

pnpm workspace によるモノレポとする。

```txt
apps/
  api/          # Hono backend
  web/          # React frontend
packages/
  shared/       # 共通型、Zod schema、ドメイン定数
  config/       # tsconfig / lint / test 設定の共有
```

バックエンドとフロントエンドは別アプリとして起動・デプロイできるようにする。ただし API 型、入力バリデーション、列挙値、チャンネル計算ロジックは `packages/shared` に寄せ、二重実装を避ける。

### 2.2 パッケージ管理

* パッケージマネージャ: pnpm
* Node.js: 24 LTS
* TypeScript: strict mode
* タスク実行: まずは pnpm scripts。必要になった段階で Turbo などを追加する

## 3. バックエンド

### 3.1 Web フレームワーク

Hono を採用する。

理由:

* TypeScript との相性がよい
* Web Standard ベースで、Node.js 以外のランタイムにも移しやすい
* 小さな API サーバとして十分軽量
* `@hono/client` による型付きクライアント生成がしやすい
* Better Auth の Hono 統合が用意されている

初期ランタイムは Node.js とし、`@hono/node-server` で起動する。

### 3.2 API 設計

API は REST/JSON を基本とする。

* ルート: `/api/*`
* 認証: Cookie ベースセッション + チーム編集トークン
* バリデーション: Zod
* API 型共有: Hono の route type または OpenAPI schema を利用
* エラー形式: 共通の JSON 形式に統一

初期方針:

* サーバ側の入力検証は必ず Zod schema を通す
* フロント側も同じ schema を利用し、送信前に検証する
* 画面都合の型と DB 型を直接混ぜない

推奨エラー形式:

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

### 3.3 データベース

PostgreSQL を採用する。

理由:

* 大会、チーム、報告、観測 WiFi、同期状態などのリレーションを自然に扱える
* JSONB、配列、インデックス、全文検索など、後の分析・検索拡張に強い
* Drizzle との相性がよい
* ローカル開発・本番・CI で同じ DB 方言を使える

ローカル開発では Docker Compose で PostgreSQL を起動する。

### 3.4 ORM / Migration

Drizzle ORM + Drizzle Kit を採用する。

理由:

* TypeScript schema を DB 定義の中心にできる
* SQL に近い書き味で、後から複雑な集計へ移行しやすい
* migration 生成と適用を Drizzle Kit に寄せられる
* Better Auth の Drizzle adapter が利用できる

ルール:

* schema は `apps/api/src/db/schema` に分割して配置する
* migration はレビュー対象としてコミットする
* DB 制約で守れるものは DB 制約に寄せる
* アプリ側制約と DB 制約の両方で重要ルールを守る

DB 制約で守るべき例:

* `team(tournament_id, name)` の unique
* 外部キー
* enum 相当の check または PostgreSQL enum
* 主要な `created_at` / `updated_at`
* `team_access.access_token_hash` の unique

アプリ側でも守るべき例:

* 1 チームあたり active / standby の WiFi 構成は最大 3 件
* チャンネル番号と周波数帯の整合性
* チャンネル幅の妥当性
* チーム編集トークンの失効確認

## 4. 認証・認可

### 4.1 方針

認証方式は利用者種別で分ける。

* 運営者: Better Auth による通常ログイン
* チーム編集者: `TeamAccess` の長期編集リンク
* 一般閲覧者: 未認証

大学・大会向けにユーザー登録を最小化するため、チーム編集者には Better Auth のユーザー作成を要求しない。

### 4.2 Better Auth の用途

Better Auth は運営者アカウントのログイン、セッション管理、将来の 2FA 追加に使う。

採用内容:

* Hono integration
* Drizzle adapter
* Cookie session
* Rate limit

初期実装では、運営者だけを Better Auth の対象にする。

### 4.3 チーム編集リンク

チーム編集リンクはアプリ独自で実装する。

仕様:

* URL には十分長いランダムトークンを含める
* DB にはトークン本体を保存せず、ハッシュのみ保存する
* トークン照合後、短期 Cookie または署名済みセッションでチーム編集権限を持たせる
* 再発行時は旧トークンを `revoked_at` で失効する
* 最終利用日時を `last_used_at` に記録する

推奨:

* トークン生成: Web Crypto または Node.js crypto
* ハッシュ: SHA-256 以上
* 比較: timing-safe comparison

### 4.4 認可モデル

権限は最初はシンプルにする。

* `public`: 公開情報の閲覧
* `team_viewer`: 特定チームの閲覧
* `team_editor`: 特定チームの編集
* `operator`: 大会全体の編集、野良 WiFi 取込、Notice 作成

すべての更新 API は、対象 `tournamentId` / `teamId` に対する権限確認を通す。

### 4.5 大会スコープ

MVP では、1 つのチーム編集リンクで触れる大会は 1 大会のみとする。

前提:

* 複数大会の開催期間は重ならない
* チーム編集リンクは特定の `teamId` に紐づき、そこから対象 `tournamentId` を決定する
* チーム編集者 UI には大会切り替えを持たせない
* 運営者 UI も MVP では現在大会を扱う前提でよい

将来、複数大会を同時運用する場合は、運営者 UI に大会切り替えを追加する。

## 5. メール送信

メール送信は SMTP を初期実装とする。

用途:

* チーム編集リンク送信
* チーム編集リンク再送
* 運営向け通知

実装方針:

* アプリケーション内では `Mailer` interface を定義し、SMTP 実装を差し込む
* メール本文生成、送信先、送信ログ、送信 provider を分離する
* SendGrid など API ベース provider へ将来移行できるようにする
* メール送信失敗は API レスポンスと監査ログに残し、再送可能にする
* コンテナ内のファイルやメモリキューには送信状態を保持しない

初期 provider:

* SMTP

将来候補:

* SendGrid API
* Amazon SES API
* Resend API

## 6. フロントエンド

### 6.1 UI フレームワーク

React + Vite を採用する。

理由:

* PWA 化しやすい
* Hono API と TypeScript 型共有しやすい
* 入力フォーム、オフライン同期、複雑な可視化を段階的に実装しやすい
* チーム内外の開発者が参加しやすい

### 6.2 ルーティング

TanStack Router を採用する。

理由:

* TypeScript で route params / search params を扱いやすい
* 画面数が多く、ネスト・保護ルートが必要になる
* ローダーやプリロード戦略を後から整理しやすい

### 6.3 サーバ状態管理

TanStack Query を採用する。

用途:

* API レスポンスのキャッシュ
* mutation
* 再取得
* 同期成功後の invalidate

ただし、オフライン作成・更新の永続キューは TanStack Query だけに任せず、Dexie 上の `SyncRecord` 相当テーブルで明示的に管理する。

### 6.4 ローカル DB / オフライン

Dexie.js を採用し、IndexedDB に保存する。

用途:

* チーム情報、WiFi 構成、機材情報、BestPractice などの閲覧用キャッシュ
* オフライン作成・更新データ
* 同期キュー
* 同期失敗理由

方針:

* オフライン時の更新は、まず Dexie に保存する
* `sync_records` に action と payload を積む
* オンライン復帰時に API へ順番に送信する
* 初期実装の競合解決は最終更新優先
* 重要項目の競合は UI で警告表示する

Service Worker は主にアプリシェルと静的アセットのキャッシュを担当し、業務データの正本管理は Dexie に寄せる。

### 6.5 PWA

vite-plugin-pwa を採用する。

実装内容:

* Web App Manifest
* Service Worker
* app shell cache
* offline fallback
* 更新通知

MVP では push 通知は対象外とする。

### 6.6 フォーム

TanStack Form + Zod を採用する。

理由:

* TanStack Router / TanStack Query と設計思想を揃えやすい
* TypeScript の型推論を活かしたフォーム実装にしやすい
* Zod schema をサーバ・フロントで共有できる
* 簡易モード / 詳細モードの段階表示に対応しやすい
* オフライン保存前の検証をフォーム層と domain schema の両方で揃えやすい

方針:

* domain schema は `packages/shared` の Zod schema を正とする
* UI 固有の一時状態は form schema として分離する
* 保存時に API payload schema へ変換して検証する

### 6.7 UI コンポーネント

UI ライブラリは Mantine を採用する。MVP では「導入後に詰まりにくいこと」「フォームとテーブルが作りやすいこと」「PWA の軽さを損なわないこと」を優先する。

採用理由:

* DatePicker、Modal、Tabs、Table、通知など MVP に必要な部品をまとめて揃えやすい
* Tailwind CSS 前提にせず React コンポーネント中心で実装できる
* 入力画面が多いアプリで、フォーム周辺の UI を短時間で整えやすい
* theme によって大会向けの見た目を後から調整しやすい
* TanStack Form と組み合わせても、入力コンポーネントを制御しやすい

導入候補:

* `@mantine/core`
* `@mantine/hooks`
* `@mantine/dates`
* `@mantine/notifications`

注意点:

* デザインの独自性は Mantine の theme と component props の範囲を基本にする
* Mantine が持たない特殊な表示は、独自コンポーネントとして追加する
* チャンネルマップの主表示は Mantine の chart 部品ではなく、引き続きカスタム SVG で実装する

### 6.8 チャンネルマップ可視化

チャンネルマップはカスタム SVG で実装する。

理由:

* チャンネル幅に応じたバー長、中心チャンネル、警告表示など独自ルールが多い
* 数十チーム・数百件程度であれば SVG で十分扱える
* アクセシビリティ、ツールチップ、選択状態を React と統合しやすい

チャートライブラリは初期採用しない。集計グラフが必要になった場合は Recharts または visx を検討する。

## 7. 共有ドメインロジック

`packages/shared` に以下を置く。

* 周波数帯、用途、深刻度などの enum
* Zod schema
* API request / response 型
* チャンネル番号と帯域の妥当性チェック
* チャンネル幅から占有範囲を計算する関数
* 同期 payload 型

最初にテストを厚くする対象:

* 2.4GHz / 5GHz / 6GHz のチャンネル妥当性
* チャンネル幅から表示範囲を出す計算
* WiFi 構成最大 3 件ルール
* IssueReport の簡易モード必須項目
* TeamAccess token の発行・失効・照合

## 8. 添付ファイル

不具合報告の詳細モードに添付があるため、MVP では保存方式を段階化する。

MVP:

* 添付 UI は任意
* アプリを stateless に保つため、コンテナ内ローカルファイルシステムには保存しない
* サーバ保存は S3 互換ストレージへ差し替え可能な抽象を置く
* DB には添付メタデータのみ保存する

本番推奨:

* S3 互換オブジェクトストレージ
* 署名付き URL
* サイズ制限
* MIME type 制限

## 9. CSV 取込

野良 WiFi 取込は CSV をブラウザでパースし、確認画面を挟んで API に送信する。

採用候補:

* Papa Parse

方針:

* CSV パース結果は Zod schema で検証する
* 不正行は行番号付きで表示する
* 一括登録 API は部分成功ではなく、原則 transaction で全件成功または全件失敗にする
* 大量データが必要になったら chunk 取込へ拡張する

## 10. テスト戦略

### 10.1 基本方針

lint、typecheck、unit test を中心にする。仕様追加・バグ修正のたびに必要なテスト項目を増やし、同じ種類の間違いが再発しないようにする。

必須コマンド:

* `pnpm lint`
* `pnpm typecheck`
* `pnpm test`
* `pnpm test:unit`

### 10.2 Lint / Format

最低限:

* Biome
* TypeScript compiler

追加候補:

* `tsc --noEmit`
* `publint`: package 公開が必要になった場合
* `knip`: 未使用 export / 依存の検出が必要になった場合

ESLint は初期採用しない。React Hooks など Biome で不足が明確になった場合に追加する。

### 10.3 Unit Test

Vitest を採用する。

重点:

* `packages/shared` の純粋関数
* Zod schema
* 権限判定
* 同期キューの状態遷移
* チャンネルマップの座標計算

### 10.4 Backend Integration Test

Vitest + Hono app request で API テストを行う。

DB を使うテストは PostgreSQL を使う。CI では PostgreSQL service container または Testcontainers を利用する。

重点:

* Team 作成
* TeamAccess 発行・失効
* WiFiConfig 最大 3 件制約
* IssueReport 作成
* ObservedWifi CSV 一括取込
* 認可漏れ
* migration 適用

### 10.5 Frontend Test

優先順:

1. shared / domain の unit test
2. API integration test
3. 重要 UI の component test
4. MVP の主要フローだけ Playwright E2E

E2E は多くしすぎない。以下だけ最初から用意する。

* チーム編集リンクでチーム詳細を開き、WiFi 構成を登録する
* オフライン状態で不具合報告を保存し、オンライン復帰後に同期する
* 運営者が野良 WiFi を CSV 取込し、チャンネルマップに反映される

## 11. 開発・CI

### 11.1 ローカル開発

想定コマンド:

```sh
pnpm install
pnpm dev
pnpm db:generate
pnpm db:migrate
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm dev` は backend と frontend を同時起動する。

### 11.2 環境変数

最低限:

```txt
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
APP_ORIGIN=
```

メール送信を実装する場合:

```txt
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

将来 API ベース provider に切り替える場合:

```txt
MAIL_PROVIDER=
SENDGRID_API_KEY=
SES_REGION=
SES_ACCESS_KEY_ID=
SES_SECRET_ACCESS_KEY=
RESEND_API_KEY=
```

### 11.3 CI

CI では以下を実行する。

* install
* Biome check
* typecheck
* unit test
* backend integration test
* migration check
* frontend build
* backend build

## 12. デプロイ

Docker ベースでデプロイする。アプリケーションコンテナは stateless とし、永続状態は PostgreSQL、オブジェクトストレージ、外部メール provider に置く。

構成:

* web: 静的ファイルとして配信する Docker image
* api: Node.js + Hono の Docker image
* db: PostgreSQL
* object storage: 添付を本格運用する段階で追加
* mail provider: 初期は SMTP

同一ドメイン配信を推奨する。

例:

* `https://wifiman.example.jp/` -> frontend
* `https://wifiman.example.jp/api/*` -> backend

同一ドメインにすると Cookie、CORS、PWA キャッシュの扱いが単純になる。開発時のみ frontend と backend の port を分ける。

stateless のためのルール:

* API コンテナにアップロードファイルを永続保存しない
* セッション、認証、同期状態は DB または署名済み Cookie に置く
* background job が必要になった場合も、キュー状態は DB または外部キューに置く
* ログは標準出力へ出し、集約基盤側で保存する
* 同一 image を複数 replica で起動できるようにする

## 13. 採用技術一覧

| 領域 | 採用 | 備考 |
| --- | --- | --- |
| Language | TypeScript | strict mode |
| Package manager | pnpm | workspace |
| Runtime | Node.js 24 LTS | backend |
| Backend | Hono | REST/JSON API |
| ORM | Drizzle ORM | PostgreSQL |
| Migration | Drizzle Kit | migration はコミット |
| DB | PostgreSQL | 本番・開発・CI で方言統一 |
| Auth | Better Auth | 運営者ログイン |
| Team access | 独自 token link | ユーザー登録を避ける |
| Frontend | React + Vite | PWA 前提 |
| Routing | TanStack Router | 型付き route |
| Server state | TanStack Query | API cache / mutation |
| Local DB | Dexie.js | IndexedDB |
| PWA | vite-plugin-pwa | Workbox |
| Form | TanStack Form + Zod | schema 共有 |
| UI | Mantine | core / hooks / dates / notifications |
| Validation | Zod | frontend/backend/shared |
| Mail | SMTP + Mailer interface | API provider へ移行可能にする |
| CSV | Papa Parse | 取込前検証 |
| Unit test | Vitest | shared/backend/frontend |
| E2E | Playwright | 主要フローのみ |
| Lint/format | Biome | 既存設定を利用 |
| Typecheck | tsc --noEmit | 必須 |

## 14. MVP 実装順

1. pnpm workspace と TypeScript 設定
2. shared の enum / Zod schema / チャンネル計算
3. Hono API skeleton
4. Drizzle schema / migration / PostgreSQL docker compose
5. Team / TeamAccess / token link
6. React + Vite skeleton
7. チーム詳細・WiFi 構成登録
8. チャンネルマップ
9. Dexie によるオフライン保存と同期キュー
10. 不具合簡易報告
11. 野良 WiFi 手入力・CSV 取込
12. Better Auth による運営者ログイン
13. 運営ダッシュボード
14. PWA 仕上げ

## 15. 未決定事項

実装前または MVP 中に決める。

* 添付ファイルを MVP に含めるか
* 運営者ログインの初期方式をメール + パスワードにするか、メールリンクにするか

## 16. 現時点の結論

初期技術選定は以下で進める。

* backend/frontend 分離の pnpm workspace
* backend は Hono + Drizzle + PostgreSQL
* 認証は Better Auth を運営者用に採用し、チーム編集は独自の長期リンク方式
* frontend は React + Vite + TanStack Router + TanStack Query
* フォームは TanStack Form + Zod
* UI は Mantine を採用する
* オフライン永続化は Dexie.js、PWA は vite-plugin-pwa
* バリデーションは Zod を shared package で共有
* メールは SMTP 実装から始め、Mailer interface で API provider へ移行可能にする
* デプロイは Docker ベース、アプリコンテナは stateless とする
* チーム編集リンクで触れる大会は 1 大会のみとする
* テストは Vitest を中心に、重要フローだけ Playwright を追加
* lint/typecheck は Biome + tsc を必須化
