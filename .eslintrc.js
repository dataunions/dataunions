module.exports = {
	env: {
		browser: false,
		commonjs: true,
		node: true,
		es2022: true,
		mocha: true,
	},
	extends: [
		'eslint:recommended',
	],
	parserOptions: {
		ecmaVersion: 2022,
	},
	rules: {
		semi: [
			'error',
			'never',
		],
		indent: [
			'error',
			'tab',
		],
		'no-useless-constructor': 0,
		'no-tabs': [
			'error',
			{
				allowIndentationTabs: true,
			},
		],
		'function-paren-newline': [
			'error',
			'consistent',
		],
		'max-len': [
			'error',
			{
				code: 180,
				tabWidth: 2,
			},
		],
		'no-unused-vars': [
			'error',
			{
				vars: 'local',
				argsIgnorePattern: '^_',
				args: 'after-used',
			},
		],
	},
}
