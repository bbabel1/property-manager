# Ora Property Management

A modern, enterprise-grade property management system built with Next.js 15, TypeScript, and Supabase.

⚠️ **Migration Status**: Authentication is now consolidated on Supabase Auth. Remaining references to NextAuth in docs/env have been removed.

## Quick Start

### 1. Install Dependencies

```bash

npm install

```

### 2. Set Up Environment

```bash
# Copy the environment template
cp env.example .env.local
```

Edit `.env.local` with your local development credentials. See [Environment Setup Guide](ENVIRONMENT_SETUP.md) for detailed instructions.

**Important**: Use different Supabase projects for local development vs production to ensure your live environment is protected.

### 3. Set Up Supabase Database

```bash
# Apply migrations through Supabase dashboard SQL editor
# Import migration files from supabase/migrations/ in order
# Follow the complete setup guide in docs/database/SUPABASE_SETUP.md
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📚 Documentation

**Complete documentation** is available in the [`docs/`](docs/) directory:

- **[📋 Documentation Index](docs/README.md)** - Start here for navigation
- **[🛡️ Environment Setup](ENVIRONMENT_SETUP.md)** - Safe environment management
- **[🏗️ Architecture Analysis](docs/architecture/CURRENT_ARCHITECTURE_ANALYSIS.md)** - Current system state
- **[🗺️ Migration Roadmap](docs/architecture/MIGRATION_STATUS_AND_ROADMAP.md)** - Conversion progress

## Features

- **Dashboard**: Overview of properties, units, occupancy rates, and key metrics

- **Property Management**: CRUD operations for properties with owner relationships

- **Unit Management**: Track units, their status, and lease information

- **Owner Management**: Manage property owners with percentage-based ownership

- **Lease Management**: Handle leases with tenant contacts and status tracking

- **Staff Management**: Assign staff to properties with role-based permissions

- **Monthly Logs**: ✨ **NEW** - Complete month-end accounting workflow
  - 7-stage guided workflow (Charges → Owner Statements)
  - Automated financial calculations (rent owed, owner draw, net to owner)
  - Professional PDF statement generation with branded templates
  - Automated email delivery with multi-recipient support
  - Complete audit trail for compliance
  - [Quick Start Guide](docs/MONTHLY_LOG_QUICK_START.md) | [Full Documentation](docs/MONTHLY_LOG_README.md)

- **Financial Calculations**: Track ownership and disbursement percentages

- **Authentication**: Secure authentication with Supabase Auth (email/password, magic links, OAuth)

## Tech Stack

- **Framework**: Next.js 15 (App Router)

- **Language**: TypeScript

- **Database**: Supabase (PostgreSQL)

- **Authentication**: Supabase Auth
- **State Management**: Zustand (global app store)
- **Monitoring**: Optional Sentry for errors and performance

- **Styling**: Tailwind CSS

- **UI Components**: Radix UI + Lucide React icons

- **Forms**: React Hook Form + Zod validation

- **Real-time**: Supabase real-time subscriptions

## Database Setup

1. Create a new Supabase project
2. Update your `.env.local` with the Supabase URL and keys
3. Run the migrations from `supabase/migrations/` in your Supabase SQL editor
4. Set up Row Level Security (RLS) policies as defined in the migrations

## Environment Variables

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for server-side operations)
- `BUILDIUM_BASE_URL`, `BUILDIUM_CLIENT_ID`, `BUILDIUM_CLIENT_SECRET`, `BUILDIUM_WEBHOOK_SECRET` - Buildium API access
- `NEXT_PUBLIC_APP_URL` - Base app URL
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps key (required by client env validation)

Optional (but supported):

- `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` - Email delivery for statements
- `COMPANY_*` fields and `COMPANY_LOGO_URL` - Company info for PDFs

## Project Structure

```text

src/
├── app/                    # Next.js App Router

│   ├── (protected)/       # Protected dashboard routes

│   ├── auth/              # Authentication pages

│   └── api/               # API routes

├── components/            # React components

│   ├── layout/            # Layout components

│   └── ui/                # Reusable UI components

├── lib/                   # Utilities and configurations

│   ├── db.ts              # Supabase client configuration

│   └── utils.ts           # Utility functions

└── types/                 # TypeScript type definitions

```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Playwright tests

## Database Schema

### Schema Documentation

- **[Detailed Schema](docs/database/DETAILED_SCHEMA.md)** - Comprehensive field-level details with constraints, defaults, and enums
- **[Schema Management Workflow](docs/database/SCHEMA_MANAGEMENT_WORKFLOW.md)** - Workflow guide for managing schema documentation
- **[Current Schema](docs/database/current_schema.sql)** - Auto-generated current database schema
- **[TypeScript Types](src/types/database.ts)** - Auto-generated TypeScript types
- **[Table Relationships](docs/database/table-relationships.md)** - Detailed table relationship documentation
- **[Buildium Integration](docs/database/buildium-integration-summary.md)** - Buildium API integration documentation

The system uses a PostgreSQL database through Supabase with the following main entities:

- **Properties**: Core property information with address and metadata

- **Units**: Individual rental units within properties

- **Owners**: Property owners (individuals or companies)

- **Ownership**: Many-to-many relationship between properties and owners with percentages

- **Leases**: Rental agreements for units

- **Staff**: Property management staff

- **Bank Accounts**: Financial account information

## Key Features

### Multi-Owner Support

- Properties can have multiple owners with different ownership percentages
- Separate ownership and disbursement percentages
- Primary owner designation for management purposes

### International Support

- Support for 200+ countries

- Comprehensive address handling
- Multi-currency support (planned)

### Financial Management

- Percentage-based ownership calculations
- Disbursement tracking
- Operating account management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT
