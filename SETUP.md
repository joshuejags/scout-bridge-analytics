# Setup Guide for Scout Bridge Analytics

## Prerequisites Installation

### Windows

1. **Install Node.js**
   - Download from: https://nodejs.org/
   - Recommended: LTS version (18.x or higher)
   - Run the installer and follow the prompts
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

2. **Install MongoDB**
   - Option A: Local Installation
     - Download from: https://www.mongodb.com/try/download/community
     - Follow installation wizard
     - Start MongoDB service
   
   - Option B: MongoDB Atlas (Cloud)
     - Create account at: https://www.mongodb.com/cloud/atlas
     - Create a free cluster
     - Get connection string

3. **Install Python** (for CV components)
   - Download from: https://www.python.org/downloads/
   - Version 3.8 or higher
   - During installation, CHECK: "Add Python to PATH"
   - Verify installation:
     ```bash
     python --version
     ```

### macOS

```bash
# Using Homebrew
brew install node
brew install mongodb-community

# Or use NVM for Node version management
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
```

### Linux (Ubuntu/Debian)

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# MongoDB
sudo apt-get install -y mongodb

# Python
sudo apt-get install -y python3 python3-pip
```

## Installation Steps (After Prerequisites)

1. **Navigate to project directory**
   ```bash
   cd scout-bridge-analytics
   ```

2. **Install all dependencies**
   ```bash
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

3. **Set up Python environment**
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate
   pip install -r server/requirements.txt

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   pip install -r server/requirements.txt
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

This will start:
- Backend server on http://localhost:5000
- Frontend app on http://localhost:3000

## Troubleshooting

### npm command not found
- Node.js is not installed or PATH not configured
- Restart terminal/VS Code after installing Node.js

### MongoDB connection refused
- Ensure MongoDB is running
- Check MONGODB_URI in .env file
- Use MongoDB Atlas if local installation issues

### Python module errors
- Activate virtual environment before running
- Verify requirements installed: `pip list`
- Update pip: `python -m pip install --upgrade pip`

### Port already in use
- Change PORT in .env file
- Or kill process using the port

## Next Steps

After installation:
1. Upload a sample video
2. Review analysis results
3. Explore the dashboard
4. Check logs for any issues

For more details, see README.md
