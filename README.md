# BPSR Build Planner

Blue Protocol: Star Resonance (BPSR) のキャラクタービルドを検討するためのビルドプランナーです。

装備品やTalent(アビリティ)によるステータス変化をゲーム外で確認・検討できるビルドプランナーUIと、
パケットキャプチャから所持品/装備/ステータス/バフ情報を取得して表示する機能を想定しています。
DPSメーターや戦闘ログ機能は初期実装の対象外です。

詳細なアーキテクチャ設計は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## 技術スタック

- Rust + [Tauri v2](https://tauri.app/)(デスクトップ版アプリ本体)
- React + TypeScript + [Vite](https://vitejs.dev/)(フロントエンドUI)
- [i18next](https://www.i18next.com/) / react-i18next(多言語対応。日本語・英語・韓国語・簡体字中国語・繁体字中国語)
- [mise](https://mise.jdx.dev/)(Node.jsのツールバージョン管理)
- 実行プラットフォームはデスクトップ版(Tauri)がWindowsを想定、Web版はブラウザで動作

## 必要環境

- [mise](https://mise.jdx.dev/) (Node.jsバージョン管理。`mise.toml`でNodeのバージョンを固定しています)
- Rust (`rustc` / `cargo`)
- Windows: Visual Studio Build Tools (C++ Build Tools ワークロード。MSVCリンカ `link.exe` が必要)

```sh
mise install        # mise.toml に従って Node を導入
npm install          # フロントエンド依存をインストール
```

## 開発時のコマンド

```sh
npm run tauri dev    # Tauriアプリを開発モードで起動 (Viteの開発サーバー + Rustバイナリ)
npm run dev           # フロントエンドのみ Vite 開発サーバーで起動
```

## ビルド

```sh
npm run build         # フロントエンドのプロダクションビルド (dist/ を生成)
npm run build:web     # Web版プロダクションビルド (dist-web/ を生成、GitHub Pages配信用)
npm run tauri build   # デスクトップ版アプリ全体をビルド (インストーラ等を含む)
```

Rust側だけをビルド/チェックする場合は `src-tauri` ディレクトリで実行します。

```sh
cd src-tauri
cargo build            # デバッグビルド
cargo build --release  # リリースビルド
```

## テスト

現状、自動テストは未整備です(フロントエンド・Rustともにテストコードはまだありません)。

テストを追加した際の実行コマンドは以下の想定です。

```sh
cd src-tauri
cargo test    # Rust側のユニット/結合テスト
```

フロントエンド側のテストフレームワーク(Vitest等)は未導入です。導入は別タスクとして検討してください。

## プロジェクト構成

```
.
├─ src-tauri/           # デスクトップ版アプリ本体 (Rust)
├─ src/                 # フロントエンド (React + TypeScript)
├─ backend/             # 短縮URL機能のバックエンド (PHP、xreaへデプロイ)
├─ index.html           # メインウィンドウのエントリ
├─ settings.html        # 設定ウィンドウのエントリ (デスクトップ版のみ)
├─ vite.config.web.ts   # Web版ビルド設定 (`npm run build:web` → `dist-web/`)
├─ docs/                # 設計ドキュメント
├─ .github/workflows/   # GitHub Pages / バックエンド デプロイ設定
└─ mise.toml            # Node.jsツールバージョン管理
```

## 参考にしているリポジトリ

BPSR固有のパケット形式やゲームデータの扱いについては、以下のリポジトリの情報を参考にしています。
**コードやリソースの流用は行っていません。**

- https://github.com/Blue-Protocol-Source/BPSR-ZDPS
- https://github.com/resonance-logs/resonance-logs
- https://github.com/winjwinj/bpsr-logs
- https://github.com/PotRooms/StarResonanceData
- https://github.com/dmlgzs/StarResonanceDamageCounter
- https://github.com/snoww/loa-logs

## ライセンス

[MIT License](LICENSE)

一部、適用対象外の範囲があります。詳細は [NOTICE.md](NOTICE.md) を参照してください。
