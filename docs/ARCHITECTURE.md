# アーキテクチャ設計

BPSR (Blue Protocol: Star Resonance) のキャラクタービルドプランナー。
装備/Talentによるステータス変化をオフラインで検討できるUIと、パケットキャプチャによる実ステータス取得を組み合わせるデスクトップアプリ。

## レイヤー構成

```
UI層 (Tauri WebView Frontend: React + TypeScript)
  - メインウィンドウ: ビルドプランナー
  - 設定ウィンドウ
  - (将来) オーバーレイウィンドウ / トレイ常駐
        |
        | Tauri Commands / Events
        v
アプリケーションコア (Rust)
  - ビルド/ステータス計算ロジック
  - 装備・Talentデータモデル
  - ユーザービルドの保存/読込
        |
        v
キャプチャ/解析層 (将来分離予定)
  - Capture抽象 (Npcap実装 → 将来WinDivert対応の余地)
  - BPSR固有パケットパーサー → ドメインイベントへ変換
        |
        v
データストア
  - 静的ゲームデータ (装備/Talent定義)
  - ユーザーデータ (ビルド保存)
  - 設定
```

- **core はパケット非依存**にする。本来の主機能であるオフラインのビルドプランニングが、キャプチャ機能なしで単独で動作・テストできることを優先する。
- capture/protocol を将来分離するのは、Npcap⇔WinDivert切替やBPSR側仕様変更への耐性を持たせるため。

## リポジトリ構成(現状)

```
.
├─ src-tauri/        # Tauriアプリ本体 (Cargo crate)
│   ├─ Cargo.toml
│   ├─ tauri.conf.json
│   ├─ build.rs
│   ├─ icons/
│   └─ src/main.rs
├─ src/               # フロントエンド (React + TS)
│   ├─ App.tsx         # メインウィンドウ
│   ├─ SettingsApp.tsx # 設定ウィンドウ(Tauri版のみ。Web版は設定を
│   │                   # BuildPlanner.tsx内のドロップダウンメニューとして表示)
│   ├─ platform/index.ts # `isTauri`判定(Tauri v2が注入する`__TAURI_INTERNALS__`の有無で分岐)
│   ├─ i18n.ts
│   ├─ platform/languages.ts # 対応言語一覧(`SUPPORTED_LANGUAGES`)。言語切替UIが共通で参照
│   └─ locales/{ja_JP,en_US,ko_KR,zh_CN,zh_TW}/{bpsr-bp-ui,game-data}.json
│       # zh_TW(繁体字)はZTableに専用データが無いため、zh_CNから
│       # scripts/derive-traditional-chinese.mjs(OpenCC変換)で導出する
├─ index.html          # メインウィンドウのエントリ
├─ settings.html        # 設定ウィンドウのエントリ(Tauriのみ使用)
├─ package.json / vite.config.ts / tsconfig*.json
├─ vite.config.web.ts  # Web配信ビルド用設定(`npm run build:web` → `dist-web/`)
└─ mise.toml           # Node/Rustツールバージョン管理
```

単一crate(`src-tauri`一つ)で開始する方針。`core` / `capture` / `protocol` への分割は、
パケットキャプチャ機能の実装に着手するタイミングで行う(Cargo workspace化)。

## Web配信(GitHub Pages)

デスクトップ(Tauri)版とは別に、ブラウザで動作するWeb版を GitHub Pages で配信している。

- ビルド: `npm run build:web`(`vite.config.web.ts` を使用、出力先 `dist-web/`)
- デプロイ: `.github/workflows/deploy-pages.yml`(GitHub Releaseの公開をトリガーに自動デプロイ)
- 配信先: `public/CNAME` に記載のカスタムドメイン(`bpsr-bp.awairo.net`)
- Web版では `platform/index.ts` の `isTauri` 判定により、Tauri固有API(設定ウィンドウの
  表示/非表示など)を使わないUIに自動的に切り替わる(設定は`BuildPlanner.tsx`内の
  ドロップダウンメニューとして表示)。

## 確定した技術選定

| 項目                 | 決定                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| Tauriバージョン      | v2                                                                            |
| フロントエンド       | React + TypeScript (Vite)                                                     |
| パッケージマネージャ | npm                                                                           |
| i18n                 | i18next / react-i18next、`src/locales/{ja_JP,en_US,ko_KR,zh_CN,zh_TW}/*.json` |
| Cargoワークスペース  | 単一crateでまず開始。capture実装着手時にworkspace化を検討                     |
| ツールバージョン管理 | mise (`mise.toml`: node)                                                      |

## ウィンドウ管理の方針

- `tauri.conf.json` の `app.windows` で `main` と `settings` を静的に定義。
  `settings` は `visible: false` で起動時は非表示。
- 設定ウィンドウの表示/非表示はフロントエンドから `@tauri-apps/api/webviewWindow` で直接操作
  (`WebviewWindow.getByLabel("settings")` → `.show()` / `.hide()`)。
- **メインウィンドウを閉じたら必ずアプリを終了**させる。設定ウィンドウが裏で存在(非表示)していると
  Tauri標準の「最後のウィンドウが閉じたら終了」が発火しないため、`main.rs` の `on_window_event` で
  `label == "main"` かつ `CloseRequested` を検知して明示的に `app_handle().exit(0)` を呼ぶ。
- 将来「閉じてもトレイに常駐」をオプション化する場合は、この `on_window_event` 内の分岐に
  設定値を読み込んで条件分岐を追加する想定。

## 未決定・今後検討すべき事項

- **データストア形式**: 静的ゲームデータ/ユーザービルドの保存形式 (JSON vs SQLite)。
  当面はJSONで十分だが、ゲームデータ量が増えた場合はSQLite (rusqlite) への移行を検討。
- **設定の永続化**: `tauri-plugin-store` を使うか、独自実装にするか。
- **パケットキャプチャ実装**: Npcap連携に使うcrate (`pcap` crate か独自FFIか)、
  権限要求(Npcapのインストール案内/管理者権限)のUXをどう設計するか。
- **WinDivert対応**: 抽象化trait設計をいつ確定するか。Capture抽象は最初のNpcap実装時に
  最小限の trait で切り出す。
- **オーバーレイウィンドウのクリックスルー**: OS依存APIが必要 (Windows: `WS_EX_TRANSPARENT`相当)。
  実装時期は未定。
- **トレイ常駐機能**: 実装時期・デフォルト動作(閉じたら終了 vs トレイに格納)を要件として確定する。

## 参考リポジトリ(コード/リソースの流用は禁止、形式・解析方法の参考のみ)

- https://github.com/Blue-Protocol-Source/BPSR-ZDPS
- https://github.com/resonance-logs/resonance-logs
- https://github.com/winjwinj/bpsr-logs
- https://github.com/PotRooms/StarResonanceData
- https://github.com/dmlgzs/StarResonanceDamageCounter
- https://github.com/snoww/loa-logs
