 
import tailwindcss from 'stylelint-config-tailwindcss';

export default {
  extends: ['stylelint-config-standard', tailwindcss],
  plugins: [],
  ignoreFiles: [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/*.min.css',
  ],
  rules: {
    'color-hex-case': 'lower',
    'color-no-invalid-hex': true,
    'selector-class-pattern': null,
    'no-empty-source': null,
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['theme'],
      },
    ],
  },
};
