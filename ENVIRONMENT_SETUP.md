# Environment Setup Guide

## 🛡️ Safe Environment Management Strategy

This guide ensures your production environment is protected while providing a clean local development setup.

## 📁 Environment File Structure

```
.env                    # Production environment (DON'T MODIFY)
.env.local              # Local development environment
.env.example            # Template for new developers
```

## 🚀 Setup Instructions

### Step 1: Create Local Development Environment

```bash
# Copy the template for local development
cp env.example .env.local
```

### Step 2: Edit .env.local with Local Credentials

```bash
# Supabase Configuration (Local Development)
NEXT_PUBLIC_SUPABASE_URL="https://your-local-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-local-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-local-service-role-key-here"

# Buildium Integration (Local Development - Sandbox)
BUILDIUM_BASE_URL="https://apisandbox.buildium.com/v1"
BUILDIUM_CLIENT_ID="your-sandbox-client-id"
BUILDIUM_CLIENT_SECRET="your-sandbox-client-secret"
BUILDIUM_API_KEY="your-sandbox-api-key"
BUILDIUM_WEBHOOK_SECRET="your-sandbox-webhook-secret"

# App Configuration (Local Development)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-local-secret-key-here"
```

### Step 3: Create Production Environment (When Ready)

```bash
# Copy template for production
cp env.example .env

# Edit .env with PRODUCTION credentials
# Use your live Supabase project and Buildium production credentials
```

## 🔒 Security Best Practices

### ✅ DO:
- Use different Supabase projects for local vs production
- Use Buildium sandbox for local development
- Keep `.env` files out of git (already in .gitignore)
- Use strong, unique secrets for each environment
- Test locally before deploying to production

### ❌ DON'T:
- Never commit `.env` files to git
- Never use production credentials in local development
- Never share environment files with others
- Never use the same secrets across environments

## 🔧 Environment Variable Priority

Next.js loads environment files in this order (later files override earlier ones):

1. `.env.local` (highest priority - local development)
2. `.env.development` (development environment)
3. `.env.production` (production environment)
4. `.env` (lowest priority - fallback)

## 🧪 Testing Your Setup

### Test Local Development:
```bash
npm run dev
# Should connect to your local Supabase project
```

### Test Environment Validation:
```bash
# Check console output for environment validation
# Should show "✅ Environment validation successful"
```

## 📋 Required Variables Checklist

### Supabase (Required):
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`

### Buildium (Optional):
- [ ] `BUILDIUM_BASE_URL`
- [ ] `BUILDIUM_CLIENT_ID`
- [ ] `BUILDIUM_CLIENT_SECRET`
- [ ] `BUILDIUM_API_KEY`
- [ ] `BUILDIUM_WEBHOOK_SECRET`

### App (Required):
- [ ] `NEXTAUTH_URL`
- [ ] `NEXTAUTH_SECRET`
- [ ] `NEXT_PUBLIC_APP_URL`

## 🆘 Troubleshooting

### Environment Validation Fails:
- Check that all required variables are set
- Ensure URLs are valid (start with http:// or https://)
- Verify secrets are at least 32 characters long

### Local Development Issues:
- Ensure `.env.local` exists and has correct values
- Check that you're using local Supabase project
- Verify Buildium sandbox credentials

### Production Issues:
- Check that `.env` has production credentials
- Verify Supabase project is correct
- Ensure Buildium production credentials are valid

## 📚 Additional Resources

- [Supabase Setup Guide](docs/database/SUPABASE_SETUP.md)
- [Buildium Integration Guide](docs/buildium-integration-guide.md)
- [Environment Variables Documentation](https://nextjs.org/docs/basic-features/environment-variables)
