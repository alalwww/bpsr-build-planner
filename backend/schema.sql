-- 短縮URL機能 DBスキーマ (MariaDB 10.6)
-- 適用方法: phpMyAdmin等でこの内容をそのまま実行する(自動マイグレーションは導入していない)。
-- 詳細仕様は docs/SHORT_URL.md を参照。

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
