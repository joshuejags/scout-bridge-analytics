#!/bin/bash
# Setup script for Scout Bridge Analytics

echo "🚀 Scout Bridge Analytics - Setup Script"
echo "=========================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Please install from: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js $(node --version) found"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✓ npm $(npm --version) found"

# Check Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "⚠️  Python not found - CV components won't work"
    echo "Install from: https://www.python.org/downloads/"
else
    PYTHON_CMD=$(command -v python3 || command -v python)
    echo "✓ Python $($PYTHON_CMD --version) found"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

echo "📦 Installing server dependencies..."
npm install --prefix server

echo "📦 Installing client dependencies..."
npm install --prefix client

# Setup Python environment if Python is available
if command -v python3 &> /dev/null || command -v python &> /dev/null; then
    echo ""
    echo "🐍 Setting up Python environment..."
    PYTHON_CMD=$(command -v python3 || command -v python)
    
    if [ ! -d "venv" ]; then
        $PYTHON_CMD -m venv venv
    fi
    
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null || true
    
    if [ -f "server/requirements.txt" ]; then
        pip install -r server/requirements.txt
    fi
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Edit .env with your configuration before running"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your MongoDB URI and other settings"
echo "2. Ensure MongoDB is running"
echo "3. Run: npm run dev"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:5000"
