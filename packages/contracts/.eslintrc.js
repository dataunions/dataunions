module.exports = {
    "env": {
        "node": true,
        "es6": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "parserOptions": {
        "ecmaVersion": 2017,
        "sourceType": "module"
    },
    "rules": {
        "indent": [
            "error",
            4,
            {
                "SwitchCase": 1,
                "flatTernaryExpressions": true
            },
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "warn",
            "never"
        ],
        "no-console": "error",
        "keyword-spacing": "error",
        "func-call-spacing": "error",
        "space-infix-ops": "error",
        "space-before-blocks": "error",
        "no-unexpected-multiline": "error"
    }
}
