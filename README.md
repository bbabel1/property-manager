# Ora Property Management

A modern, enterprise-grade property management system built with Next.js 15, TypeScript, and Supabase.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
cp env.example .env.local
```

Edit `.env.local` and add your Supabase URL, keys, and NextAuth configuration.

### 3. Set Up Database
```bash
# Run the Supabase migrations
# You can do this through the Supabase dashboard or CLI
# Import the migration files from supabase/migrations/
```

### 4. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Features

- **Dashboard**: Overview of properties, units, occupancy rates, and key metrics
- **Property Management**: CRUD operations for properties with owner relationships
- **Unit Management**: Track units, their status, and lease information
- **Owner Management**: Manage property owners with percentage-based ownership
- **Lease Management**: Handle leases with tenant contacts and status tracking
- **Staff Management**: Assign staff to properties with role-based permissions
- **Financial Calculations**: Track ownership and disbursement percentages
- **Authentication**: Secure authentication with NextAuth.js and Supabase

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: NextAuth.js with Supabase
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
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for development)
- `NEXTAUTH_SECRET` - Random string for JWT encryption

## Project Structure

```
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
