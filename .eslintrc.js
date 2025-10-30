module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Development-friendly configuration
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_', // Ignore unused parameters starting with underscore
        varsIgnorePattern: '^_', // Ignore unused variables starting with underscore
        caughtErrorsIgnorePattern: '^_', // Ignore unused caught errors starting with underscore
      }
    ],
    '@typescript-eslint/no-explicit-any': 'off', // Allow any for flexibility
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/ban-ts-comment': 'off', // Allow @ts-ignore for development
    '@typescript-eslint/no-duplicate-enum-values': 'error', // Critical error
    '@typescript-eslint/no-var-requires': 'warn', // Allow require() with warning
    'no-console': 'off', // Allow console for debugging
    'no-constant-condition': 'warn', // Allow intentional infinite loops
    'no-useless-catch': 'warn', // Allow pass-through catches
    'no-useless-escape': 'warn', // Allow escape chars in regex
    'prefer-const': 'warn', // Suggest const but don't force
  },
};