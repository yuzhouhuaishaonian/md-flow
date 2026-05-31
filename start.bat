@echo off
chcp 65001 >nul
setlocal

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8080"

set "DIR=%~dp0"
cd /d "%DIR%"

where node >nul 2>nul
if %errorlevel%==0 (
    echo Starting MD Flowchart Editor: http://localhost:%PORT%
    echo Press Ctrl+C to stop the server
    node "%DIR%start.js" %PORT%
    goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
    echo Starting MD Flowchart Editor: http://localhost:%PORT%
    echo Press Ctrl+C to stop the server
    python -m http.server %PORT%
    goto :eof
)

echo Node.js or Python not found. Please install one of them, or open index.html directly in a browser (some export features may be limited).
exit /b 1
