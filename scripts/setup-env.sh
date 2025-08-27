#!/bin/bash

# Environment Setup Script
# This script helps set up environment files safely

echo "🛡️  Environment Setup Script"
echo "================================"

# Check if .env.local already exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists!"
    echo "   If you want to recreate it, delete the existing file first."
    echo "   rm .env.local"
    exit 1
fi

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    echo "   This might contain production credentials."
    echo "   Please backup before proceeding:"
    echo "   cp .env .env.production.backup"
    read -p "   Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Setup cancelled."
        exit 1
    fi
fi

# Create .env.local from template
echo "📝 Creating .env.local from template..."
cp env.example .env.local

if [ $? -eq 0 ]; then
    echo "✅ .env.local created successfully!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Edit .env.local with your LOCAL development credentials"
    echo "2. Use a different Supabase project for local development"
    echo "3. Use Buildium sandbox environment for testing"
    echo ""
    echo "📖 See ENVIRONMENT_SETUP.md for detailed instructions"
else
    echo "❌ Failed to create .env.local"
    exit 1
fi

echo ""
echo "🔒 Security Reminder:"
echo "- .env.local is in .gitignore (safe to edit)"
echo "- Never commit .env files to git"
echo "- Use different credentials for local vs production"
echo ""
echo "🎉 Environment setup complete!"
