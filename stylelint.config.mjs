/* eslint-env node */

import tailwindcss from 'stylelint-config-tailwindcss';

const config = {
  extends: ['stylelint-config-standard', tailwindcss],
  plugins: [],
  ignoreFiles: [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/*.min.css',
  ],
  rules: {
    'color-no-invalid-hex': true,
    'selector-class-pattern': null,
    'no-empty-source': null,
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['theme'],
      },
    ],
    // Tailwind v4 directives and design tokens rely on non-standard at-rules and imports
    'at-rule-no-unknown': null,
    'import-notation': 'string',
    'no-invalid-position-at-import-rule': null,
    'at-rule-empty-line-before': null,
    'declaration-empty-line-before': null,
    'declaration-block-single-line-max-declarations': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'custom-property-empty-line-before': null,
    'comment-empty-line-before': null,
    'alpha-value-notation': null,
    'color-function-notation': null,
    'color-hex-length': null,
    'value-keyword-case': null,
  },
};

export default config;
