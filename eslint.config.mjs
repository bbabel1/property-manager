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
    rules: {
      // Custom rule to warn about deprecated basic mappers
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
      ]
    }
  }
];

export default eslintConfig;
