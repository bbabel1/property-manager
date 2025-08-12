# PropertyManager Professional Edition

A modern, enterprise-grade property management system built with Next.js 14, TypeScript, and Prisma.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
cp env.example .env.local
```

Edit `.env.local` and add your database URL and NextAuth configuration.

### 3. Set Up Database
```bash
# Push the schema to your database
npm run db:push

# Or run migrations (if you prefer)
npm run db:migrate

# Seed the database with sample data
npm run db:seed
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
- **Authentication**: Magic link authentication with NextAuth.js

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + Lucide React icons
- **Forms**: React Hook Form + Zod validation

## Database Setup

1. Create a PostgreSQL database
2. Update your `.env.local` with the database URL
3. Run `npm run db:push` to create tables
4. Run `npm run db:seed` to add sample data

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── auth/              # Authentication pages
│   └── api/               # API routes
├── components/            # React components
│   ├── features/          # Feature-specific components
│   ├── layout/            # Layout components
│   └── ui/                # Reusable UI components
└── lib/                   # Utilities and configurations
    ├── auth.ts            # NextAuth configuration
    ├── db.ts              # Prisma client
    └── utils.ts           # Utility functions
```

## Environment Variables

Required environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for development)
- `NEXTAUTH_SECRET` - Random string for JWT encryption
- `EMAIL_SERVER_*` - Email configuration for magic link auth

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT
