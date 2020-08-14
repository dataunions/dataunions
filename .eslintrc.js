module.exports = {
    "env": {
        "node": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2017
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
            "off",
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
