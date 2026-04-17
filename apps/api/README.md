# @wifiman/api

ロボコン会場向け WiFi 運用支援アプリのバックエンド API サーバー。

## 技術スタック

- **フレームワーク**: [Hono](https://hono.dev/) + [@hono/node-server](https://github.com/honojs/node-server)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **DB**: PostgreSQL 16
- **認証**: [Better Auth](https://www.better-auth.com/)
- **バリデーション**: [Zod](https://zod.dev/)

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 接続文字列 |
| `BETTER_AUTH_SECRET` | ✅ | Better Auth の署名シークレット (16文字以上) |
| `BETTER_AUTH_URL` | ✅ | Better Auth のベース URL |
| `APP_ORIGIN` | ✅ | フロントエンドの Origin (CORS 用) |
| `PORT` | - | サーバーポート (デフォルト: 3000) |
| `SMTP_HOST` | - | SMTP サーバーホスト |
| `SMTP_PORT` | - | SMTP ポート |
| `SMTP_USER` | - | SMTP ユーザー名 |
| `SMTP_PASSWORD` | - | SMTP パスワード |
| `SMTP_FROM` | - | 送信元メールアドレス |

## スクリプト

```sh
# 開発サーバー起動
pnpm dev

# 型チェック
pnpm typecheck

# ビルド
pnpm build

# DB マイグレーション生成
pnpm db:generate

# DB マイグレーション適用
pnpm db:migrate

# DB GUI (Drizzle Studio)
pnpm db:studio

# ユニットテスト
pnpm test:unit

# 全テスト (統合テスト含む)
pnpm test
```

## ローカル開発

```sh
# プロジェクトルートで
cp .env.example .env
# .env を編集

# Docker Compose で PostgreSQL 起動
docker compose up -d

# 依存パッケージインストール
pnpm install

# マイグレーション
pnpm db:generate
pnpm db:migrate

# 開発サーバー起動
pnpm dev
```

## API エンドポイント

| メソッド | パス | 権限 | 説明 |
|---------|------|------|------|
| GET | /api/tournaments | public | 大会一覧 |
| POST | /api/tournaments | operator | 大会作成 |
| GET | /api/tournaments/:id | public | 大会詳細 |
| PATCH | /api/tournaments/:id | operator | 大会更新 |
| GET | /api/tournaments/:id/teams | public | チーム一覧 |
| POST | /api/tournaments/:id/teams | operator | チーム作成 |
| GET | /api/teams/:id | team_viewer | チーム詳細 |
| PATCH | /api/teams/:id | team_editor | チーム更新 |
| GET | /api/teams/:id/wifi-configs | team_viewer | WiFi 構成一覧 |
| POST | /api/teams/:id/wifi-configs | team_editor | WiFi 構成作成 |
| PATCH | /api/wifi-configs/:id | team_editor | WiFi 構成更新 |
| DELETE | /api/wifi-configs/:id | team_editor | WiFi 構成削除 |
| GET | /api/teams/:id/device-specs | team_viewer | 機材仕様一覧 |
| POST | /api/teams/:id/device-specs | team_editor | 機材仕様作成 |
| PATCH | /api/device-specs/:id | team_editor | 機材仕様更新 |
| GET | /api/tournaments/:id/issue-reports | team_viewer | 報告一覧 |
| POST | /api/tournaments/:id/issue-reports | team_editor | 報告作成 |
| GET | /api/issue-reports/:id | team_viewer | 報告詳細 |
| PATCH | /api/issue-reports/:id | team_editor | 報告追記 |
| GET | /api/tournaments/:id/observed-wifis | public | 野良 WiFi 一覧 |
| POST | /api/tournaments/:id/observed-wifis | operator | 野良 WiFi 手動登録 |
| POST | /api/tournaments/:id/observed-wifis/bulk | operator | 野良 WiFi CSV 一括登録 |
| GET | /api/tournaments/:id/best-practices | public | ベストプラクティス一覧 |
| POST | /api/best-practices | operator | ベストプラクティス作成 |
| PATCH | /api/best-practices/:id | operator | ベストプラクティス更新 |
| GET | /api/tournaments/:id/notices | public | お知らせ一覧 |
| POST | /api/tournaments/:id/notices | operator | お知らせ作成 |
| PATCH | /api/notices/:id | operator | お知らせ更新 |
| POST | /api/teams/:id/team-accesses | operator | 編集リンク発行 |
| POST | /api/team-accesses/:id/revoke | operator | 編集リンク失効 |
| POST | /api/auth/team-link | public | チーム編集リンク認証 |
| * | /api/auth/* | - | Better Auth エンドポイント |
