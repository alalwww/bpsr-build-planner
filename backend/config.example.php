<?php

declare(strict_types=1);

// backend/public/config.php (gitignore対象) のテンプレート。
// ローカル動作確認時はこのファイルを backend/public/config.php としてコピーして値を書き換える。
// 本番デプロイでは .github/workflows/deploy-backend.yml が GitHub Secrets からこのファイルと
// 同じ形式の config.php を生成してアップロードするため、手動でのコピーは不要。

// CORS許可オリジンは秘密情報ではないため、ここには含めない
// (backend/public/lib/bootstrap.php の SHORTURL_ALLOWED_ORIGIN 定数を参照)。

return [
    'db' => [
        'dsn' => 'mysql:host=localhost;dbname=bpsr_shorturl;charset=utf8mb4',
        'user' => 'db_user',
        'password' => 'db_password',
    ],
    // レート制限カウンタのIPハッシュ化に使うソルト。推測されないランダム文字列に変更すること。
    'rate_limit_salt' => 'change-me',
];
