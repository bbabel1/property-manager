# Supabase Setup Guide

## Environment Variables Required

To connect to Supabase, you need to set up the following environment variables in your `.env.local` file:

### 1. Create `.env.local` file

Create a `.env.local` file in your project root with the following variables:

```bash

# Supabase Configuration

NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# NextAuth.js

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Email (for magic link auth)

EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="noreply@yourdomain.com"

# App

NEXT_PUBLIC_APP_URL="http://localhost:3000"

```

### 2. Get Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project or select an existing one
3. Go to **Settings** → **API**

4. Copy the following values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`

   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Database Schema

Make sure your Supabase database has the following tables:
- `properties` - Property information
- `units` - Unit information linked to properties
- `owners` - Owner information
- `ownerships` - Relationship between properties and owners

### 4. Mock Data Mode

If Supabase is not configured, the application will automatically fall back to mock data. You'll see visual indicators
(yellow badges) showing which data is coming from mock sources.

### 5. Restart Development Server

After setting up the environment variables, restart your development server:

```bash

npm run dev

```

## Visual Indicators

When using mock data, you'll see:
- 🟡 **Yellow banner** at the top of property pages

- 🟡 **"Mock" badges** next to field labels that aren't in the database

- 🟡 **"Mock Data" indicator** in the page header

This helps you identify which fields need to be added to your Supabase database schema.
