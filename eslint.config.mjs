import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', '**/components/ui/**', 'node_modules', 'src-tauri', 'scripts', 'api'] },
  ...tseslint.config(
    {
      files: ['**/*.{ts,tsx}'],
      extends: [tseslint.configs.recommended],
      languageOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
        globals: {
          window: 'readonly',
          document: 'readonly',
          localStorage: 'readonly',
          console: 'readonly',
          navigator: 'readonly',
          location: 'readonly',
          history: 'readonly',
          URL: 'readonly',
          Blob: 'readonly',
          FileReader: 'readonly',
          HTMLElement: 'readonly',
          HTMLInputElement: 'readonly',
          HTMLTextAreaElement: 'readonly',
          Event: 'readonly',
          KeyboardEvent: 'readonly',
          MouseEvent: 'readonly',
          DragEvent: 'readonly',
          ClipboardEvent: 'readonly',
          setTimeout: 'readonly',
          clearTimeout: 'readonly',
          setInterval: 'readonly',
          clearInterval: 'readonly',
          requestAnimationFrame: 'readonly',
          cancelAnimationFrame: 'readonly',
          fetch: 'readonly',
        },
      },
      plugins: {
        'react-hooks': reactHooks,
        'react-refresh': reactRefresh,
      },
      rules: {
        ...reactHooks.configs.recommended.rules,
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'no-console': 'off',
        'prefer-const': 'error',
      },
    },
  ),
]
