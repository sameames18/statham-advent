import js from '@eslint/js';
import globals from 'globals';

// Recommended rules only: this catches mistakes (undefined names, unused
// variables, unreachable code), not style. Formatting is left to review.
export default [
  { ignores: ['.vercel/', 'node_modules/'] },
  js.configs.recommended,
  {
    rules: {
      // `const { gross, ...rest } = film` is how a field is dropped here.
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['server/**', 'api/**', 'scripts/**', 'test/**', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['public/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Playwright tests pass callbacks into the page, which run in the browser.
    files: ['test/browser/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
