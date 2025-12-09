import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Global ignores (Flat config replacement for .eslintignore)
  {
    ignores: [
      "backups/**",
      "docs/**",
      "scripts/**",
      "stories/**",
      "supabase/**",
      ".next/**",
      "next-env.d.ts",
      "fix-markdown.js",
      // Ignore generated or vendor type definitions
      "src/types/**"
    ]
  },
  // Warn when importing the service-role client; enforce guard review per file
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/lib/db",
              importNames: ["supabaseAdmin"],
              message:
                "Service role usage detected: ensure org_id resolution and requireOrgAdmin/Member guard before calling supabaseAdmin. If truly global, document in audit ledger."
            }
          ]
        }
      ]
    }
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
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
  },
  // TypeScript-specific overrides
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off"
    }
  },
  // Loosen rules for type declaration files if they slip past ignores
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off"
    }
  }
];

export default eslintConfig;
