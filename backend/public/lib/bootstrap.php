<?php

declare(strict_types=1);

// CORSで許可するオリジン(Web版の配信ドメイン)。秘密情報ではなく、フロント側の
// shortUrl.ts にも同じ値が直書きされている単一の本番オリジンなので、config.php
// (秘密情報のみ・gitignore対象) には含めずここに定数として持つ。
// これにより、OPTIONSプリフライトの応答がconfig.php/DBの読み込みに一切依存しなくなる
// (config.php未配置・DB障害時でもCORSプリフライトだけは常に成功する)。
const SHORTURL_ALLOWED_ORIGIN = 'https://bpsr-bp.awairo.net';

// config.php (gitignore対象) を読み込む。public/直下に配置されるが、.htaccessで直アクセスは
// 拒否している (backend/public/.htaccess 参照)。
function shorturl_config(): array
{
    static $config = null;
    if ($config === null) {
        $path = __DIR__ . '/../config.php';
        if (!is_file($path)) {
            shorturl_send_json(500, ['error' => 'server_misconfigured']);
        }
        $config = require $path;
    }
    return $config;
}

function shorturl_db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $db = shorturl_config()['db'];
        $pdo = new PDO($db['dsn'], $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

// JSONレスポンスを送信して処理を終了する。$extraHeadersは "ヘッダ名 => 値" の連想配列。
function shorturl_send_json(int $status, array $body, array $extraHeaders = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    foreach ($extraHeaders as $name => $value) {
        header($name . ': ' . $value);
    }
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function shorturl_send_cors_headers(): void
{
    header('Access-Control-Allow-Origin: ' . SHORTURL_ALLOWED_ORIGIN);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

function shorturl_client_ip(): string
{
    // xrea側のプロキシ構成の詳細が不明なため、クライアントが自由に偽装できる
    // X-Forwarded-For等は信頼せず、REMOTE_ADDRのみを正とする。
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
