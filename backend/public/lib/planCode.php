<?php

declare(strict_types=1);

// 実測worst-case(装備/モジュール/幻影ツリー全部盛りを誇張した値)で約1,500文字だったため、
// 十分な余裕を持たせつつ暴走リクエストを弾ける値として設定 (docs/SHORT_URL.md 参照)。
const SHORTURL_PLAN_CODE_MAX_LENGTH = 10000;

// short_links.format_version は SMALLINT UNSIGNED (0〜65535) で保存するため、収まらない値は
// 保存前に弾く。桁数も5桁までに制限し、巨大な数字列をintキャストした際の不定動作を避ける。
const SHORTURL_FORMAT_VERSION_MAX = 65535;

// フロントの planCode.ts が生成する "{version}:{encodedName}:{structuralData}" 形式を
// 検証し、プラン名(encodedName)部分を切り捨てて [formatVersion, structuralData] に分解する。
// 短縮URLは他人と共有される前提のため、ユーザーが自由入力したプラン名は保存しない
// (docs/SHORT_URL.md 参照)。意味的なデコードはフロント側の decodePlanCode に任せ、ここでは
// 「壊れたデータ・無関係な文字列を保存しない」ための形式チェックのみ行う。
// 妥当なら [formatVersion, structuralData] を、そうでなければnullを返す。
function shorturl_parse_plan_code(string $planCode): ?array
{
    $length = strlen($planCode);
    if ($length === 0 || $length > SHORTURL_PLAN_CODE_MAX_LENGTH) {
        return null;
    }
    if (!preg_match('/^(\d{1,5}):[^:]*:([^:]+)$/', $planCode, $matches)) {
        return null;
    }
    $formatVersion = (int) $matches[1];
    if ($formatVersion > SHORTURL_FORMAT_VERSION_MAX) {
        return null;
    }
    return [$formatVersion, $matches[2]];
}

// 保存済みの [formatVersion, structuralData] から、フロントの decodePlanCode が読める
// "{version}:{空のプラン名}:{structuralData}" 形式を組み立てる。
function shorturl_build_plan_code(int $formatVersion, string $structuralData): string
{
    return $formatVersion . '::' . $structuralData;
}
