import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "scripts/**",
      "supabase/functions/**",
      "backups/**",
      "docs/**/examples/**",
      // Ignore generated or vendor type definitions
      "src/types/**"
    ],
    rules: {
      // Prevent usage of deprecated basic mappers
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/buildium-mappers"],
              importNames: [
                "mapPropertyFromBuildium", 
                "mapBankAccountFromBuildium", 
                "mapGLAccountFromBuildium"
              ],
              message: "⚠️ Use enhanced mappers (mapPropertyFromBuildiumWithBankAccount, mapBankAccountFromBuildiumWithGLAccount, mapGLAccountFromBuildiumWithSubAccounts) to ensure proper relationship handling"
            }
          ]
        }
      ],
      // Custom rule to warn about deprecated basic mappers (fallback for non-import usage)
      "no-restricted-globals": [
        "error",
        {
          name: "mapPropertyFromBuildium",
          message: "⚠️ Use mapPropertyFromBuildiumWithBankAccount() instead to ensure proper bank account relationship handling"
        },
        {
          name: "mapBankAccountFromBuildium", 
          message: "⚠️ Use mapBankAccountFromBuildiumWithGLAccount() instead to ensure proper GL account relationship handling"
        },
        {
          name: "mapGLAccountFromBuildium",
          message: "⚠️ Use mapGLAccountFromBuildiumWithSubAccounts() instead to ensure proper sub_accounts relationship handling"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // Treat unused vars as warnings in CI; allow underscore prefix
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }
      ],
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/no-unescaped-entities": "off"
    }
  }
];

export default eslintConfig;
