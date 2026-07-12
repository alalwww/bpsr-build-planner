import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Lint対象はフロントエンドのソースのみ(ビルド成果物・Tauri側・設定ファイルは除外)。
// 型の厳密さは tsc -b (strict) が担うため、ESLint は JS の落とし穴と
// React hooks のルール(呼び出し位置・依存配列)の検出を担当する。
export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-web/**', 'src-tauri/**', 'node_modules/**', '*.js', '*.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // 従来からコード中の disable コメントが前提にしていた2ルール。
      // v7 の recommended に含まれる React Compiler 系ルール(set-state-in-effect /
      // preserve-manual-memoization 等)は、既存の意図的なパターン(プランロード時の
      // state 同期 effect 等)を多数指摘するため導入時点では採用しない(将来検討)。
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // tsc(noUnusedLocals/noUnusedParameters)と重複するが、`_`始まりの慣用を許可して併用する
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
