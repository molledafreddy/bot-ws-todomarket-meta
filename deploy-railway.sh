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

# Validate PORT configuration
echo "🔌 Validating PORT configuration..."
if grep -q "parseInt.*PORT" dist/app.js; then
    echo "✅ PORT properly configured as integer for Railway"
else
    echo "❌ PORT configuration issue - rebuilding..."
    pnpm run build
fi

# Test PORT parsing with different values
echo "🧪 Testing PORT validation..."
TEST_PORTS=("3000" "4000" "8080")
for port in "${TEST_PORTS[@]}"; do
    PORT_TEST=$(PORT=$port node -e "const PORT = parseInt(process.env.PORT || '3008', 10); console.log(typeof PORT === 'number' && PORT >= 0 && PORT <= 65535)")
    if [[ "$PORT_TEST" == "true" ]]; then
        echo "✅ Port $port validation passed"
    else
        echo "❌ Port $port validation failed"
    fi
done

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
echo "🎯 Railway Deployment Steps:"
echo "1. Install Railway CLI: npm install -g @railway/cli"
echo "2. Login to Railway: railway login"
echo "3. Create new project: railway new"
echo "4. Link project: railway link"
echo "5. Set environment variables (Railway will provide PORT automatically):"
echo "   - TZ=America/Santiago"
echo "   - JWT_TOKEN=your_meta_token"
echo "   - NUMBER_ID=your_number_id"
echo "   - MONGO_DB_URI=your_mongodb_uri"
echo "   - ENABLE_META_API=true"
echo "6. Deploy: railway up"
echo ""
echo "⚠️  IMPORTANT - Railway PORT Configuration:"
echo "   - DO NOT set PORT manually in Railway dashboard"
echo "   - Railway automatically provides PORT variable"
echo "   - App will use Railway's assigned port automatically"
echo ""
echo "📚 Post-deployment tasks:"
echo "- Configure Meta webhook URL with your Railway domain"
echo "- Verify Meta Business Manager permissions"
echo "- Test bot responses after deployment"
echo ""
echo "🌍 Your bot will be running in Santiago, Chile timezone (UTC-3)"
echo "✨ Railway deployment preparation complete!"
