<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/base62.php';
require __DIR__ . '/lib/planCode.php';
require __DIR__ . '/lib/ratelimit.php';

// POST /shorten (発行) と GET /shorten?code=xxx (解決) をメソッドで分岐する。
// URLに拡張子を出さないため、public/.htaccess のmod_rewriteでこのファイルへ内部転送される。
// 詳細仕様は docs/SHORT_URL.md を参照。

// content_hashに一致する既存レコードがあれば、そのcodeを200で返して処理を終了する(dedupe)。
// 見つからなければ何もせず戻る(呼び出し側が新規発行処理を続ける)。
function shorturl_send_existing_code_if_found(PDOStatement $selectByHash, string $contentHash): void
{
    $selectByHash->execute(['hash' => $contentHash]);
    $existing = $selectByHash->fetch();
    if ($existing !== false) {
        shorturl_send_json(200, ['code' => $existing['code']]);
    }
}

function shorturl_handle_post(): void
{
    $pdo = shorturl_db();

    $ipHash = shorturl_ip_hash(shorturl_client_ip(), shorturl_config()['rate_limit_salt']);
    if (!shorturl_check_and_increment_rate_limit($pdo, $ipHash)) {
        shorturl_send_json(429, ['error' => 'rate_limited']);
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw !== false ? $raw : '', true);
    if (!is_array($data) || !isset($data['planCode']) || !is_string($data['planCode'])) {
        shorturl_send_json(400, ['error' => 'invalid_format']);
    }

    $planCode = $data['planCode'];
    $parsed = shorturl_parse_plan_code($planCode);
    if ($parsed === null) {
        $tooLarge = strlen($planCode) > SHORTURL_PLAN_CODE_MAX_LENGTH;
        shorturl_send_json(400, ['error' => $tooLarge ? 'too_large' : 'invalid_format']);
    }
    [$formatVersion, $structuralData] = $parsed;

    // dedupeは「プラン名を除いた構造データ」単位で行う。プラン名は保存しないため、
    // 同一ビルドを別名でエクスポートした場合も同じ短縮コードに集約される。
    $contentHash = hash('sha256', $formatVersion . ':' . $structuralData);

    $selectByHash = $pdo->prepare('SELECT code FROM short_links WHERE content_hash = :hash');
    // 同一ビルドの再発行はdedupeし、既存の短縮コードを返す。
    shorturl_send_existing_code_if_found($selectByHash, $contentHash);

    $insert = $pdo->prepare(
        'INSERT INTO short_links (code, structural_data, format_version, content_hash) '
        . 'VALUES (:code, :structural_data, :format_version, :content_hash)'
    );

    // codeのUNIQUE制約違反(生成コードの衝突)時は再試行する。ごく低確率のcontent_hash競合
    // (同時リクエストで先に別プロセスがdedupeを完了させたケース)は既存codeを返して終了する。
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $code = shorturl_generate_code();
        try {
            $insert->execute([
                'code' => $code,
                'structural_data' => $structuralData,
                'format_version' => $formatVersion,
                'content_hash' => $contentHash,
            ]);
            shorturl_send_json(201, ['code' => $code]);
        } catch (PDOException $e) {
            if ($e->getCode() !== '23000') {
                throw $e;
            }
            // ごく低確率のcontent_hash競合(同時リクエストで先に別プロセスがdedupeを完了させた
            // ケース)は既存codeを返して終了する。それ以外はcode側の衝突とみなし、次のループで
            // 新しいcodeを生成する。
            shorturl_send_existing_code_if_found($selectByHash, $contentHash);
        }
    }

    shorturl_send_json(500, ['error' => 'code_generation_failed']);
}

function shorturl_handle_get(): void
{
    $code = $_GET['code'] ?? '';
    if (!is_string($code) || !shorturl_is_valid_code($code)) {
        shorturl_send_json(400, ['error' => 'invalid_format']);
    }

    $pdo = shorturl_db();
    $select = $pdo->prepare('SELECT format_version, structural_data FROM short_links WHERE code = :code');
    $select->execute(['code' => $code]);
    $row = $select->fetch();

    if ($row === false) {
        // 将来そのコードが発行される可能性があるため、404は長期キャッシュしない。
        shorturl_send_json(404, ['error' => 'not_found'], ['Cache-Control' => 'no-store']);
    }

    $update = $pdo->prepare(
        'UPDATE short_links SET hit_count = hit_count + 1, last_accessed_at = UTC_TIMESTAMP() WHERE code = :code'
    );
    $update->execute(['code' => $code]);

    // code→structural_dataの対応は発行後不変なので、長期キャッシュしてオリジンへの再リクエストを防ぐ
    // (docs/SHORT_URL.md キャッシュ節参照)。プラン名は保存していないため空名称で復元される。
    $planCode = shorturl_build_plan_code((int) $row['format_version'], $row['structural_data']);
    shorturl_send_json(200, ['planCode' => $planCode], [
        'Cache-Control' => 'public, max-age=31536000, immutable',
    ]);
}

shorturl_send_cors_headers();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'OPTIONS':
        http_response_code(204);
        exit;
    case 'POST':
        shorturl_handle_post();
        break;
    case 'GET':
        shorturl_handle_get();
        break;
    default:
        shorturl_send_json(405, ['error' => 'method_not_allowed']);
}
