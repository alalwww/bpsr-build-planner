<?php

declare(strict_types=1);

const SHORTURL_BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SHORTURL_CODE_LENGTH = 5;

function shorturl_generate_code(): string
{
    $alphabet = SHORTURL_BASE62_ALPHABET;
    $max = strlen($alphabet) - 1;
    $code = '';
    for ($i = 0; $i < SHORTURL_CODE_LENGTH; $i++) {
        $code .= $alphabet[random_int(0, $max)];
    }
    return $code;
}

// DB列(VARCHAR(8))に収まる範囲で、英数字のみを許可する(クライアントからの`code`パラメータ検証用)。
function shorturl_is_valid_code(string $code): bool
{
    return (bool) preg_match('/^[0-9A-Za-z]{1,8}$/', $code);
}
