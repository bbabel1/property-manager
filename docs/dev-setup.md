# Developer Setup

## Environment configuration

Use `src/config/index.ts` to access environment variables with validation and type safety. The module parses `process.env` once at startup and throws a readable error if required values (for example `BUILDIUM_BASE_URL`, `BUILDIUM_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`) are missing or malformed. Import `config` instead of `process.env` in new code:

```ts
import { config } from '@/config';

const apiBase = config.BUILDIUM_BASE_URL;
```
