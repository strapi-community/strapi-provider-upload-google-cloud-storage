module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  extends: ['@strapi/eslint-config/back/typescript', 'plugin:node/recommended-module'],
  rules: {
    'node/no-missing-import': [
      'error',
      {
        tryExtensions: ['.ts', '.js', '.json'],
      },
    ],
    'no-param-reassign': ['error', { props: false }],
  },
};
