# 短縮URL機能 仕様

エクスポートコード(`planCode.ts`で生成される、lz-string圧縮+Base64のプレーンテキスト)は
装備・モジュール・幻影ツリー等をフル指定すると数百〜1000文字超になり、そのままURLに埋め込むには
長すぎる。xrea上のPHP+DBバックエンドでコードとの対応表を保持し、短い識別子でエクスポートコードを
引けるようにする。
また、短縮URLの生成を用いたシェアができるように、シェアボタンを配置し
X.com への投稿や共有用のリンクのコピーを行えるようにする予定である。
現時点では**Web版(GitHub Pages配信)のみ対象**。デスクトップ版(Tauri)は未リリースのため対象外だが、
リリース時には短縮URLの生成およびそれを用いたシェア、およびURLからのインポートのサポートも行う予定。

## 全体構成

```
ブラウザ (bpsr-bp.awairo.net, GitHub Pages 静的配信)
  |
  | 発行: POST https://api.awairo.net/shorten          { planCode }
  | 解決: GET  https://api.awairo.net/shorten?code=xxx
  v
xrea (s269.xrea.com) - api.awairo.net (専用サブドメイン)
  PHP 7.4.33 + MariaDB 10.6.24 (PDO_mysql)
```

発行・解決は同一の`shorten.php`にまとめ、`$_SERVER['REQUEST_METHOD']`(POST/GET)で処理を分岐する。
拡張子(`.php`)をURLに出さないため、`.htaccess`の`mod_rewrite`で拡張子なしURLを内部的に実ファイルへ
書き換える。

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME}\.php -f
RewriteRule ^(.*)$ $1.php [L]
```

ディレクトリ(`shorten/index.php`)方式ではなく、この内部リライト方式を採用する。ディレクトリ方式は
実ディレクトリが存在するため、末尾スラッシュなしアクセス時にApache(`mod_dir`)が`/shorten/`へ
301/302リダイレクトしてしまい、POSTがGETに化ける・ボディが失われるリスクがあった。内部リライトは
ブラウザに返す**外部リダイレクトを伴わない**ため、この問題が構造的に発生しない。xrea標準のFastCGI
向け`.php`ハンドラ割り当ては拡張子ベースでリライト後も変わらず適用されるため、xrea側の設定変更は
不要。

`/shorten`(および内部リライト後の`shorten.php`)以外への直接アクセス(`config.php`の直叩き、想定外の
パスへのアクセス等)は`https://awairo.net/`へ302リダイレクトする(`backend/public/.htaccess`)。
素の403/404を返さないことで、意図しないアクセスに対して余計な情報を出さない。

短縮URL自体(`bpsr-bp.awairo.net/#/xxx`)はGitHub Pagesの静的サイト側のURLであり、APIサーバー側で
302リダイレクトを返す構成にはしない(できない)。SPAが起動時にURLからコードを読み取り、`shorten`
(GET)にfetchしてエクスポートコードへ変換 → 既存の`decodePlanCode`でビルド復元する。

## URL形式

```
https://bpsr-bp.awairo.net/#/aB3xY
```

- `#/`以降が短縮コード。フラグメント(`#`以降)はサーバーに送信されないため、GitHub Pages側の
  ルーティング設定・404トリック・追加の静的ファイルは一切不要(常にルートの`index.html`が返る)。
- 短縮コードは **Base62・5桁**(`62^5 ≈ 9.16億`通り)。発行時に重複チェックしてリトライする。

## フロントエンド側の変更

実装は `src/build-planner/shortUrl.ts` に集約する(`resolveShortCode` / `shortenPlanCode` /
`buildShortUrl` / `extractShortCodeFromHash` / `buildXShareIntentUrl` / `buildLineShareIntentUrl`)。
API_BASE(`https://api.awairo.net`)・共有URLのオリジン(`https://bpsr-bp.awairo.net`)は本番環境が
単一のためビルド時環境変数化はせずソース内に直接定数として持つ。

1. **起動時のURL解決**: `location.hash`が`#/`で始まる場合、以降を短縮コードとして抽出し
   `GET {API_BASE}/shorten?code=xxx`をfetch。成功したら`decodePlanCode`に渡し、既存の
   インポート確認フロー(`importPlanCode`)に載せる。取り込み後は
   `history.replaceState(null, '', location.pathname + location.search)`でハッシュを消し、
   リロード時の二重インポートを防ぐ。専用コンポーネント(`ShortUrlImporter.tsx`)としてWeb版
   (`!isTauri`)のみ`App.tsx`にマウントする。
2. **共有ボタン**: キャラクターパネルのリセット行右端(保存ボタンの左隣)に常設の共有アイコン
   ボタン(`ShareBuildButton.tsx`)を配置(Web版のみ表示、`platform/index.ts`の`isTauri`判定で
   分岐)。クリックするとプラン保存等と同じ中央固定モーダル(`ConfirmDialog`)が開く。モーダル内
   「共有リンクを作成」ボタンを押すと`POST {API_BASE}/shorten`に現在の`exportPlanCode()`結果を
   送信し、成功するとURL入力欄(選択・コピーのみ可、`readOnly`で編集不可)・コピーボタン・
   X/LINE/本文コピーのアイコン行が活性化する(発行前はすべて無効化して表示)。レート制限の詳細
   (閾値等)はUI上には出さず、箇条書きの注意文だけ案内する。API失敗時はエラーメッセージを
   表示するが、表示有無でダイアログの高さが変わらないよう常に領域を確保し`visibility:hidden`
   で切り替える。このダイアログはエクスポートダイアログ(`PlanManager.tsx`)と相互に切り替え
   可能(互いに「エクスポートへ切替」「共有へ切替」ボタンを持つ。開閉状態は`PlanManager`が
   `open`/`onOpenChange` propで制御する制御コンポーネント)。
3. **シェア導線**: 共有内容は用途別に2種類ある。
   - **URL単体のコピー**: 貼り付け先を選ばない最小限の共有(URL欄横の「コピー」ボタン)
   - **文面付きの共有/コピー**: クラス名(型名)・能力スコア・URLを含む文面(X/LINE/クリップ
     ボードの3アイコン)。X用の文言のみ末尾にハッシュタグ(`#スタレゾ`/`#BPSR` +
     サービスタグ`#bpsr_bp`)を付与する。ハッシュタグはXでの発見性向上を狙ったX特有の文化の
     ため、LINE/クリップボードにコピーする文面には付けない。文言は`bpsr-bp-ui.json`の
     `shareText`(本文、ロケール別)・`shareXHashtags`(Xのみ追加するハッシュタグ、ロケール別)
     キーで管理する。X/LINEは新規タブではなく`window.open()`で550×470の小さいポップアップ
     ウィンドウとして開く(`noopener`付き)。Discordには X/LINEのような「投稿画面を開くURL」が
     存在しない(特定サーバー/チャンネル宛の投稿という概念しかなく、個人の公開タイムラインが
     無いため)ため専用の導線は用意せず、クリップボードアイコン(文面コピー)で代替する。

## バックエンド(`backend/`)

このリポジトリ内にモノレポとして同居させる(呼ぶ側・呼ばれる側を分離せず一元管理するため)。

```
backend/
├─ public/               # xreaのドキュメントルート(api.awairo.net)にそのままデプロイする実体
│  ├─ shorten.php         # POST /shorten (発行) と GET /shorten?code=xxx (解決) を
│  │                       # $_SERVER['REQUEST_METHOD']で分岐して1ファイルに実装
│  ├─ lib/                # 発行/解決で共有するロジック(コード生成・バリデーション等)。
│  │                       # 直アクセスは.htaccess(lib/内・public/直下の両方)で拒否
│  ├─ .htaccess            # 拡張子なしURLへのmod_rewrite・直アクセス制限等
│  └─ config.php           # DB接続情報(gitignore対象、config.example.phpから複製して使う)
├─ config.example.php     # 設定テンプレート(コミット対象、ダミー値)
├─ schema.sql             # DBスキーマ(phpMyAdmin等で手動適用)
└─ README.md              # デプロイ手順
```

`lib/`を`public/`の外(`backend/lib/`)ではなく`public/lib/`に置くのは、FTPデプロイ(手動・GitHub
Actions共に)を`public/`単一ディレクトリのアップロードだけで完結させるため。`shorten.php`からの
`require`が`__DIR__ . '/../lib/...'`(ドキュメントルートの外を参照)だと、デプロイ時に`public/`しか
アップロードしなければ`lib/`が存在せず致命的エラー(500)になる。直アクセスは`public/.htaccess`の
直アクセスリダイレクトに加え、`lib/.htaccess`(`Require all denied`)でも二重に拒否している。

依存関係はComposer等を使わず素のPHPで完結させる(エンドポイント2本の規模のため)。

### API仕様

`shorten.php`が`$_SERVER['REQUEST_METHOD']`でPOST/GETを分岐する。

#### `POST /shorten`(発行)

- Request: `{ "planCode": "2:...:..." }`
- バリデーション: 文字列必須・長さ上限(仮 10,000文字。実測worst-caseは約1,500文字)・
  形式チェック(`^\d{1,5}:[^:]*:[^:]+$`程度、意味的な検証はしない)・バージョン番号は
  `format_version`カラムの型(`SMALLINT UNSIGNED`、0〜65535)に収まる範囲のみ許可
- **プラン名(`{encodedName}`部分)は保存前に切り捨てる**。短縮URLは他人と共有される前提であり、
  ユーザーが自由入力したプラン名まで保存・公開する必要はないため。バージョン(`format_version`)と
  構造データ(`structural_data`)のみDBに保存する(下記DBスキーマ参照)
- 同一`format_version . ':' . structural_data`のSHA-256(`content_hash`)が既存にあれば、
  新規発行せず既存の`code`を返す(dedupe)。プラン名は保存しないため、同一ビルドを別名で
  エクスポートした場合も同じ短縮コードに集約される
- レート制限: IPごとに簡易な時間窓カウント(初期案 1分あたり5回。閾値は運用しながら調整)
- Response 200/201: `{ "code": "aB3xY" }`
- Response 400: `{ "error": "invalid_format" }` / `{ "error": "too_large" }`
- Response 429: `{ "error": "rate_limited" }`

#### `GET /shorten?code=xxx`(解決)

- 保存済みの`format_version`・`structural_data`から`"{version}::{structuralData}"`
  (プラン名部分は空)を組み立てて返す。フロントの`decodePlanCode`は空プラン名を正常に
  デコードできるため、復元後のプラン名は空文字列になる
- Response 200: `{ "planCode": "2::..." }`(アクセスごとに`hit_count`・`last_accessed_at`を更新)
- Response 404: `{ "error": "not_found" }`

POST/GET/OPTIONSいずれも `Access-Control-Allow-Origin: https://bpsr-bp.awairo.net` 固定(書き込み
APIを含むためワイルドカード不可)。この値は秘密情報ではないため`config.php`ではなく
`public/lib/bootstrap.php`の`SHORTURL_ALLOWED_ORIGIN`定数に直書きしており、CORSヘッダの送信(および
OPTIONSプリフライトへの応答)が`config.php`やDBの読み込みに一切依存しない設計にしている。
(仮デプロイ時、`config.php`未配置の状態でOPTIONSプリフライトが500になる不具合があったための対応。
以前は`allowed_origin`を`config.php`側に持たせていたため、CORSヘッダ送信のたびに`config.php`の
存在チェックが走り、無ければ500を返していた。)

### キャッシュ

`code → planCode`の対応は発行後不変(同じ`code`は常に同じ`planCode`を返す)なので、`GET /shorten`の
成功レスポンスにはブラウザキャッシュを積極的に効かせ、同じ短縮URLへの再アクセス・リロード時に
オリジンへ再リクエストさせない。

- 200レスポンス: `Cache-Control: public, max-age=31536000, immutable`
  (`immutable`対応ブラウザではリロード時の条件付きGETすら発生しない)
- 404(`not_found`)レスポンス: `Cache-Control: no-store`(将来そのコードが存在するようになる
  可能性があるため長期キャッシュしない)
- CORSレスポンスヘッダ(`Access-Control-Allow-Origin`)もキャッシュされた応答に含まれて再利用される
  ため、キャッシュヒット時も追加のCORS考慮は不要。
- トレードオフ: キャッシュから応答した場合はオリジンに到達しないため`hit_count`/
  `last_accessed_at`が更新されない。これらは「正確なアクセス数」ではなく「オリジンへの到達回数の
  目安」になる。
- フロント側(localStorage等での永続キャッシュ)は現状見送り。1ページロード内で同じコードを
  複数回resolveすることは通常ないため、HTTPキャッシュのみで十分と判断。必要になれば追加検討する。

### DBスキーマ

```sql
CREATE TABLE short_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(8) NOT NULL,
  structural_data TEXT NOT NULL,               -- planCodeからプラン名部分を除いた構造データのみ保存。
                                                -- プラン名はユーザーの自由入力かつ短縮URLは他人と
                                                -- 共有される前提のため、そもそも保存しない。
  format_version SMALLINT UNSIGNED NOT NULL,   -- planCodeの先頭"{version}:"を解析して保存。
                                                -- 将来「旧バージョンを非対応→削除対象」にする際の
                                                -- フィルタ用(自動削除の実装自体は現状スコープ外)
  content_hash CHAR(64) NOT NULL,              -- SHA-256(format_version . ':' . structural_data)。dedupe用
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME NULL,
  hit_count INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_code (code),
  UNIQUE KEY uq_content_hash (content_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shorten_rate_limit (
  ip_hash CHAR(64) NOT NULL,      -- SHA-256(IP + サーバー側ソルト)。生IPは保存しない
  window_start DATETIME NOT NULL, -- 分単位に丸めた時刻
  request_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## デプロイ

- サーバー: `s269.xrea.com`、専用サブドメイン `api.awairo.net`(独自ドメイン+SSL対応済み)
- CI: GitHub Actionsから`backend/public/`をFTPデプロイ(例: `SamKirkland/FTP-Deploy-Action`)
- 接続情報はGitHub Secrets経由(`XREA_FTP_HOST` / `XREA_FTP_USERNAME` / `XREA_FTP_PASSWORD` /
  `XREA_FTP_REMOTE_DIR`)。ローカル確認用の`.env`的な複製ファイルは`.gitignore`対象とし、必須ではない
  (AIエージェントから参照できる範囲に実クレデンシャルを置く必要はないため)
- DBスキーマの適用はphpMyAdmin等で手動(自動マイグレーションは導入しない)

## 未決定・今後検討すべき事項

- `api.awairo.net`のxrea上のドキュメントルート実パス(サブドメイン作成後に確定、FTPデプロイ先パスの
  設定に必要)
- レート制限の具体的な閾値(初期値は仮置き、運用しながら調整)
- 保持期限ポリシー・`format_version`ベースの定期削除バッチ(xreaのCronで実現可能な想定だが実装は
  スコープ外)
- バックエンドの自動テスト(PHPUnit等)は未整備
- GitHub Secretsの登録はユーザー側の手動作業(このリポジトリ側では設定不可)
- **デスクトップ版(Tauri)対応時の呼び出し方式**: ブラウザの`fetch`で直接呼ぶ場合、Tauriのorigin
  (`tauri://localhost`等、プラットフォームで表記が異なる)を`Access-Control-Allow-Origin`に
  追加する必要がある。あるいはRust側(`src-tauri`)にHTTPクライアントを持たせてTauri Command経由で
  API呼び出しを行い、ブラウザのCORS制約自体を回避する設計も選択肢。デスクトップ版リリース時に
  改めて決定する。
- **Xシェア文言**: `x.com/intent/post`の`text`パラメータ(職業名・GS等をどこまで含めるか)は未確定。
- **CDN導入**: 現状は`Cache-Control`によるブラウザキャッシュのみ。アクセスが増えてオリジンの
  PHP/DB負荷が問題になった場合、`api.awairo.net`前段にCDN(Cloudflare等)を置くことで
  ブラウザキャッシュが効かないユーザー間でも共有キャッシュとして機能させられる。現時点では過剰と
  判断し見送り。
