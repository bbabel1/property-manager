# Project Rules

This document outlines the key rules and guidelines for maintaining code quality and consistency in the property manager project.

## Buildium Integration Rules

### 1. API Documentation Priority

**Rule**: ALWAYS reference the official "Open API, powered by Buildium (v1)" documentation first when working with any Buildium-related functions.

**Rationale**: The official Buildium API documentation is the authoritative source for:

- Correct endpoint URLs and HTTP methods
- Request/response schemas and data structures
- API behavior and limitations
- Authentication requirements
- Rate limiting policies

**Implementation**:

- Before implementing any Buildium API call, consult the official documentation
- Use the documentation to verify endpoint paths, parameters, and response formats
- When debugging API issues, cross-reference with the official documentation first
- Update local documentation (like `docs/BUILDIUM_API_QUICK_REFERENCE.md`) based on official documentation

**Examples**:

- ✅ "According to the Buildium API documentation, the correct endpoint for fetching a tenant is `/associations/tenants/{tenantId}`"
- ❌ "I'll use `/rentals/tenants/{id}` based on the existing code pattern"

### 2. Environment Configuration

**Rule**: Always use `.env.local` for local development and ensure proper environment variable loading.

**Implementation**:

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });
```

### 3. Error Handling

**Rule**: Implement comprehensive error handling for all Buildium API calls.

**Implementation**:

- Check `response.ok` before processing data
- Log actionable context for debugging
- Never log secrets, API keys, or PII
- Handle rate limiting and retry logic appropriately

### 4. Data Validation

**Rule**: Always validate Buildium API responses before processing.

**Implementation**:

- Use TypeScript interfaces to define expected response structures
- Validate required fields before database operations
- Handle optional fields gracefully
- Implement proper error handling for malformed responses

## Database Rules

### 1. Schema Consistency

**Rule**: Always verify database schema before implementing data mappings.

**Implementation**:

- Check migration files for current schema structure
- Use proper field names and types
- Handle NOT NULL constraints appropriately
- Include required timestamp fields (`created_at`, `updated_at`)

### 2. Relationship Management

**Rule**: Implement proper foreign key relationships and handle missing references.

**Implementation**:

- Use helper functions for relationship resolution
- Handle "not found" scenarios gracefully
- Implement proper error handling for missing relationships
- Document relationship resolution chains

## Code Quality Rules

### 1. TypeScript Usage

**Rule**: Use TypeScript strict mode and avoid `any` types without clear justification.

**Implementation**:

- Define proper interfaces for all data structures
- Use type guards for runtime validation
- Return typed responses from all functions
- Validate inputs at the boundaries

### 2. File Organization

**Rule**: Follow Next.js conventions and maintain stable file paths.

**Implementation**:

- Use conventional naming and directory structure
- Keep file paths stable during refactors
- Group related files logically
- Use descriptive file names

### 3. Documentation

**Rule**: Keep documentation current and update relevant sections when code changes.

**Implementation**:

- Update API documentation when endpoints change
- Maintain current database schema documentation
- Document architectural decisions and rationale
- Provide examples and usage patterns

## Testing and Validation Rules

### 1. Verification Before Claims

**Rule**: Never claim success unless the operation has been explicitly verified.

**Implementation**:

- Test API calls with real data
- Verify database operations completed successfully
- Check for expected side effects
- Validate data integrity after operations

### 2. Cleanup

**Rule**: Always clean up temporary files and test scripts after use.

**Implementation**:

- Remove temporary scripts after testing
- Clean up test data when appropriate
- Document cleanup procedures
- Use proper error handling to ensure cleanup occurs

## Security Rules

### 1. Environment Variables

**Rule**: Never hardcode secrets or sensitive data in source code.

**Implementation**:

- Use environment variables for all configuration
- Validate environment variables at startup
- Use proper secret management practices
- Document required environment variables

### 2. Data Protection

**Rule**: Never log or expose sensitive information.

**Implementation**:

- Log only actionable context for debugging
- Never log API keys, passwords, or PII
- Use proper error handling to avoid data leaks
- Implement proper access controls

## Migration and Deployment Rules

### 1. Database Migrations

**Rule**: Always test migrations locally before applying to remote environments.

**Implementation**:

- Test migrations on local database first
- Use idempotent migration scripts
- Include proper rollback capabilities
- Document migration rationale and effects

### 2. Backup Procedures

**Rule**: Create backups before making significant changes.

**Implementation**:

- Backup database before major schema changes
- Document backup and restore procedures
- Test backup integrity
- Maintain backup retention policies

---

## Enforcement

These rules should be followed by all developers working on the project. Code reviews should include verification that these rules have been followed. Violations should be addressed promptly to maintain code quality and system reliability.
