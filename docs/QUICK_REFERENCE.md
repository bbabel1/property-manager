# Quick Reference Guide

## 🗄️ DATABASE SCHEMA MANAGEMENT

### Current Schema Workflow

```bash
# Generate current database schema (after migrations)
npm run db:schema

# (Optional) Dump remote linked schema snapshot
npm run db:schema:linked

# Generate TypeScript types from database
npm run db:types

# Update all database documentation
npm run db:docs
```

### Best Practices

- **Always run `npm run db:docs` after making schema changes**
- **Use `docs/database/current_schema.sql` as the authoritative current schema**
- **Migration files show the evolution, current_schema.sql shows the current state**
- **Generated TypeScript types in `src/types/database.ts` match actual database**
- **CI `check-schema-drift` workflow also uploads a `supabase-schema-public` SQL artifact from the linked remote project**
