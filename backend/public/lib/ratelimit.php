<?php

declare(strict_types=1);

// 初期値。運用しながら調整する (docs/SHORT_URL.md 未決定事項参照)。
const SHORTURL_RATE_LIMIT_PER_MINUTE = 5;

function shorturl_ip_hash(string $ip, string $salt): string
{
    return hash('sha256', $salt . '|' . $ip);
}

// IPごとに1分あたりのリクエスト回数を制限する簡易レート制限。
// 許可されればtrue(カウントを1つ消費済み)、拒否されればfalseを返す。
function shorturl_check_and_increment_rate_limit(PDO $pdo, string $ipHash): bool
{
    $windowStart = gmdate('Y-m-d H:i:00');

    $pdo->beginTransaction();
    try {
        $select = $pdo->prepare(
            'SELECT request_count FROM shorten_rate_limit WHERE ip_hash = :ip AND window_start = :ws FOR UPDATE'
        );
        $select->execute(['ip' => $ipHash, 'ws' => $windowStart]);
        $row = $select->fetch();

        if ($row === false) {
            $insert = $pdo->prepare(
                'INSERT INTO shorten_rate_limit (ip_hash, window_start, request_count) VALUES (:ip, :ws, 1)'
            );
            $insert->execute(['ip' => $ipHash, 'ws' => $windowStart]);
            $pdo->commit();
            return true;
        }

        if ((int) $row['request_count'] >= SHORTURL_RATE_LIMIT_PER_MINUTE) {
            $pdo->commit();
            return false;
        }

        $update = $pdo->prepare(
            'UPDATE shorten_rate_limit SET request_count = request_count + 1 WHERE ip_hash = :ip AND window_start = :ws'
        );
        $update->execute(['ip' => $ipHash, 'ws' => $windowStart]);
        $pdo->commit();
        return true;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}
