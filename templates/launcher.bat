@echo off
setlocal
chcp 65001 >nul 2>&1

set "SD=%~dp0"

rem --- Isolated config dir (bypass global OAuth) ---
set "CLAUDE_CONFIG_DIR=%USERPROFILE%\.__BRAND_LOWER__"
if not exist "%CLAUDE_CONFIG_DIR%" mkdir "%CLAUDE_CONFIG_DIR%"

rem --- Sync CLAUDE.md if exists ---
if exist "%SD%CLAUDE.md" copy /y "%SD%CLAUDE.md" "%CLAUDE_CONFIG_DIR%\CLAUDE.md" >nul

rem --- API config ---
set "ANTHROPIC_AUTH_TOKEN=__API_KEY__"
set "ANTHROPIC_API_KEY="
set "ANTHROPIC_BASE_URL=__API_BASE_URL__"
set "ENABLE_TOOL_SEARCH=false"
set "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1"

rem --- Prefer portable node in same dir ---
if exist "%SD%node.exe" set "PATH=%SD%;%PATH%"

rem --- Commands ---
if "%~1"=="help" goto :help
if "%~1"=="--help" goto :help
if "%~1"=="-h" goto :help
if "%~1"=="version" ( echo __BRAND__ v1.0.0 & exit /b 0 )
if "%~1"=="patch" ( node "%SD%patch.js" "%SD%cli.js" & exit /b )

rem --- Launch ---
if not exist "%SD%cli.js" (
    echo [ERROR] cli.js not found in %SD%
    echo Put cli.js in the same folder as this script.
    pause
    exit /b 1
)

if "%~1"=="" (
    echo.
    echo   __BRAND__ v1.0.0
    echo   API: %ANTHROPIC_BASE_URL%
    echo.
    node "%SD%cli.js"
) else (
    node "%SD%cli.js" %*
)
exit /b 0

:help
echo.
echo   __BRAND__ v1.0.0
echo.
echo   __BRAND_LOWER__             Start __BRAND__
echo   __BRAND_LOWER__ patch       Re-run brand patch
echo   __BRAND_LOWER__ version     Show version
echo   __BRAND_LOWER__ [args]      Pass args to CLI
echo   __BRAND_LOWER__ help        This message
echo.
exit /b 0
