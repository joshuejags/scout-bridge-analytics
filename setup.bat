@echo off
REM Setup script for Scout Bridge Analytics (Windows)

echo.
echo 🚀 Scout Bridge Analytics - Setup Script
echo ==========================================
echo.

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js is not installed
    echo Please install from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js %NODE_VERSION% found

REM Check npm
where npm >nul 2>nul
if errorlevel 1 (
    echo ❌ npm is not installed
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✓ npm %NPM_VERSION% found

REM Check Python
where python >nul 2>nul
if errorlevel 1 (
    echo ⚠️  Python not found - CV components won't work
    echo Install from: https://www.python.org/downloads/
) else (
    for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
    echo ✓ %PYTHON_VERSION% found
)

REM Install dependencies
echo.
echo 📦 Installing dependencies...
call npm install

echo 📦 Installing server dependencies...
call npm install --prefix server

echo 📦 Installing client dependencies...
call npm install --prefix client

REM Setup Python environment
where python >nul 2>nul
if errorlevel 0 (
    echo.
    echo 🐍 Setting up Python environment...
    
    if not exist "venv" (
        python -m venv venv
    )
    
    call venv\Scripts\activate.bat
    
    if exist "server\requirements.txt" (
        pip install -r server\requirements.txt
    )
)

REM Check for .env file
if not exist ".env" (
    echo.
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Edit .env with your configuration before running
)

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Edit .env with your MongoDB URI and other settings
echo 2. Ensure MongoDB is running
echo 3. Run: npm run dev
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000
echo.
pause
