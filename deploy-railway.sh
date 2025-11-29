#!/bin/bash

# Railway deployment script for WhatsApp Bot
# This script prepares and validates the deployment environment

echo "🚄 Preparing Railway deployment for WhatsApp Bot..."

# Check if required files exist
echo "📋 Checking deployment files..."

required_files=("railway.json" ".env.production" "Dockerfile" "package.json")
for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file exists"
    else
        echo "❌ $file not found"
        exit 1
    fi
done

# Validate environment variables template
echo "🔧 Validating environment variables..."
if grep -q "TZ=America/Santiago" .env.production; then
    echo "✅ Timezone configured for Santiago, Chile"
else
    echo "❌ Timezone not configured"
fi

if grep -q "JWT_TOKEN=" .env.production; then
    echo "✅ Meta JWT token configuration found"
else
    echo "❌ Meta JWT token configuration missing"
fi

if grep -q "MONGO_DB_URI=" .env.production; then
    echo "✅ MongoDB configuration found"
else
    echo "❌ MongoDB configuration missing"
fi

# Build test (optional)
if command -v pnpm &> /dev/null; then
    echo "🔨 Testing build process..."
    pnpm run build
    if [[ $? -eq 0 ]]; then
        echo "✅ Build successful"
    else
        echo "❌ Build failed"
        exit 1
    fi
fi

echo ""
echo "🎯 Deployment checklist:"
echo "1. Install Railway CLI: npm install -g @railway/cli"
echo "2. Login to Railway: railway login"
echo "3. Create new project: railway new"
echo "4. Link project: railway link"
echo "5. Set environment variables from .env.production"
echo "6. Deploy: railway up"
echo ""
echo "📚 Don't forget to:"
echo "- Configure Meta webhook URL with your Railway domain"
echo "- Verify Meta Business Manager permissions"
echo "- Test bot responses after deployment"
echo ""
echo "🌍 Your bot will be running in Santiago, Chile timezone (UTC-3)"
echo "✨ Railway deployment preparation complete!"
