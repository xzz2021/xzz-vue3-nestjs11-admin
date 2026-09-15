/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard', 'stylelint-config-html/vue'],
  ignoreFiles: ['dist/**', 'dist-*/**', 'node_modules/**', 'stats.html'],
  overrides: [
    {
      files: ['**/*.less'],
      customSyntax: 'postcss-less'
    },
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html'
    }
  ],
  rules: {
    'selector-class-pattern': null,
    'selector-id-pattern': null,
    'import-notation': null,
    'custom-property-empty-line-before': null,
    'comment-empty-line-before': null,
    'no-invalid-position-declaration': null,
    'declaration-property-value-no-unknown': null,
    'media-query-no-invalid': null,
    'property-no-unknown': null,
    'selector-pseudo-element-colon-notation': null,
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['unocss', 'apply']
      }
    ],
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['deep', 'global', 'slotted', 'export']
      }
    ]
  }
};
