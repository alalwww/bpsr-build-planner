# 短縮URL バックエンド (backend/)

`bpsr-bp.awairo.net`(Web版)向け短縮URL API。仕様の詳細は [docs/SHORT_URL.md](../docs/SHORT_URL.md) を参照。

## 構成

- `public/` — xreaのドキュメントルート(`api.awairo.net`)にそのままデプロイする実体
  - `lib/` — `shorten.php`から読み込む共有ロジック。`public/`直下ではなく`public/lib/`に置くのは、
    FTPデプロイ(手動・GitHub Actions共に)を`public/`単一ディレクトリのアップロードだけで完結させる
    ため。直アクセスは`public/.htaccess`の直アクセスリダイレクトに加え`lib/.htaccess`でも拒否している
- `schema.sql` — DBスキーマ(phpMyAdmin等で手動適用。Docker利用時はコンテナ初回起動時に自動適用)
- `config.example.php` — 設定テンプレート(DB接続情報・レート制限ソルトのみ。CORS許可オリジンは
  秘密情報ではないため`public/lib/bootstrap.php`の`SHORTURL_ALLOWED_ORIGIN`定数に直書きしている)
- `Dockerfile` / `docker-compose.yml` — ローカル動作確認用(xreaへのデプロイには使わない)

## ローカル動作確認(Docker)

PHP 7.4 + Apache(mod_rewrite有効・`AllowOverride All`) + MariaDB 10.6をxreaに近い構成で
起動する。`.htaccess`(拡張子非表示・直アクセス制限)込みで確認したい場合はこちらを使う。

```sh
cp backend/config.example.php backend/public/config.php
```

`backend/public/config.php`の`dsn`の`host=localhost`を`host=db`に変更する(user/password/dbnameは
`config.example.php`の値のまま`docker-compose.yml`のDB設定と一致させてあるので変更不要)。

```sh
cd backend
docker compose up -d
```

`http://localhost:8080/shorten`に対してPOST/GETでリクエストして動作を確認する。

```sh
curl -X POST http://localhost:8080/shorten -d '{"planCode":"2:...:..."}'
curl "http://localhost:8080/shorten?code=xxxxx"
```

DBの中身を見たい場合は`http://localhost:8081`(Adminer)で`db`サービスに接続する(サーバー: `db`、
ユーザー名/パスワードは上記と同じ)。停止するには`docker compose down`(`-v`を付けるとDBデータも削除)。

## ローカル動作確認(PHPのみ、簡易)

`.htaccess`の挙動を無視して構造データの入出力だけ素早く確認したい場合は、PHP本体だけでも動く。
PHPはmiseでは管理していない(miseの`vfox-php`プラグインはソースビルド前提でWindowsでは
ビルドツール一式が無いと失敗するため、`mise.toml`には追加していない)。Windowsでは
[windows.php.net](https://windows.php.net/download/)からPHP 7.4系のNTS版を手動で取得し、
PATHを通すか、WSL上のPHPを利用する。

```sh
cp backend/config.example.php backend/public/config.php
# backend/public/config.php を編集し、手元のMySQL/MariaDBの接続情報を設定する
php -S localhost:8000 -t backend/public
```

`http://localhost:8000/shorten`に対してPOST/GETでリクエストして動作を確認する(PHP組み込み
サーバーは`.htaccess`を解釈しないため、拡張子なしURL・直アクセス制限は再現されない)。

```sh
curl -X POST http://localhost:8000/shorten -d '{"planCode":"2:...:..."}'
curl "http://localhost:8000/shorten?code=xxxxx"
```

## デプロイ

本番デプロイは `.github/workflows/deploy-backend.yml` が担う。`backend/**` への変更のpush
(mainブランチ)、または手動実行(workflow_dispatch)をトリガーに、GitHub Secretsから
`config.php`を生成した上で`public/`配下をxreaへFTPアップロードする。必要なSecretsは以下の通り。

| Secret名                   | 内容                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `XREA_FTP_HOST`            | FTPホスト名                                                      |
| `XREA_FTP_USERNAME`        | FTPユーザー名                                                    |
| `XREA_FTP_PASSWORD`        | FTPパスワード                                                    |
| `XREA_FTP_REMOTE_DIR`      | アップロード先ディレクトリ(`api.awairo.net`のドキュメントルート) |
| `SHORTURL_DB_DSN`          | PDO DSN(例: `mysql:host=...;dbname=...;charset=utf8mb4`)         |
| `SHORTURL_DB_USER`         | DBユーザー名                                                     |
| `SHORTURL_DB_PASSWORD`     | DBパスワード                                                     |
| `SHORTURL_RATE_LIMIT_SALT` | レート制限のIPハッシュ化用ソルト(ランダム文字列)                 |

これらのSecretsの登録はGitHubリポジトリ設定からの手動作業(このリポジトリ側では設定不可)。

## DBスキーマの適用

`schema.sql` の内容をphpMyAdmin等で一度だけ手動実行する(自動マイグレーションは導入していない)。
