# WiFiMan Web

## 開発用運営ログイン

ローカル擬似ログインは通常ビルドでは無効です。開発環境でのみ、以下の両方を設定した場合にサーバ検証 API 経由の仮 session を利用できます。

- VITE_ENABLE_DEV_OPERATOR_AUTH=true
- API 側で DEV_OPERATOR_AUTH_ENABLED=true と DEV_OPERATOR_AUTH_PASSPHRASE を設定

## オフライン遷移の確認手順

1. オンライン状態でトップ画面を開き、PWA 登録後に一度リロードする
2. ブラウザの DevTools で Offline に切り替える
3. / と /offline を相互遷移し、どちらも App Shell 経由で表示されることを確認する
4. 保護ルートを確認する場合は、事前にサーバ検証済み session を作成してから /app または /app/sync を開く