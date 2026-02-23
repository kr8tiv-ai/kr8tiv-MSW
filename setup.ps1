# MSW Protocol Setup Script (Windows PowerShell)
# Automated installation and configuration for Claude Code

$ErrorActionPreference = "Stop"
$MSW_DIR = $PSScriptRoot
$CLAUDE_DIR = Join-Path $env:USERPROFILE ".claude"
$MCP_CONFIG = Join-Path $CLAUDE_DIR "mcp.json"
$MCP_SERVER_PATH = Join-Path $MSW_DIR "dist\mcp\index.js"
$ORIGINAL_DIR = (Get-Location).Path

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "                     MSW Protocol Setup                        " -ForegroundColor Cyan
Write-Host "              Make Shit Work - Automated Install              " -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

function Write-Step {
    param(
        [string]$Message,
        [string]$Color = "Yellow"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Ok {
    param([string]$Message)
    Write-Host "  [ok] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  [fail] $Message" -ForegroundColor Red
}

function Load-McpConfig {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return [pscustomobject]@{}
    }

    $raw = Get-Content -Raw -Path $Path
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return [pscustomobject]@{}
    }

    try {
        return $raw | ConvertFrom-Json
    }
    catch {
        Write-Host ""
        Write-Host "  [warn] Existing MCP config is invalid JSON. Recreating." -ForegroundColor Yellow
        Write-Host "         File: $Path" -ForegroundColor Yellow
        return [pscustomobject]@{}
    }
}

# Step 1: Check Node.js
Write-Step "[1/7] Checking Node.js..."
try {
    $nodeVersion = node --version
    Write-Ok "Node.js $nodeVersion installed"
}
catch {
    Write-Fail "Node.js not found. Please install from https://nodejs.org"
    exit 1
}

# Step 2: Install dependencies
Write-Step "`n[2/7] Installing dependencies..."
Set-Location $MSW_DIR
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Fail "npm install failed"
    exit 1
}
Write-Ok "Dependencies installed"

# Step 3: Build TypeScript
Write-Step "`n[3/7] Building TypeScript..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Build failed"
    exit 1
}
Write-Ok "Build successful"

# Step 4: Create .claude directory if needed
Write-Step "`n[4/7] Configuring Claude Code..."
if (-not (Test-Path $CLAUDE_DIR)) {
    New-Item -ItemType Directory -Path $CLAUDE_DIR -Force | Out-Null
    Write-Ok "Created $CLAUDE_DIR"
}
else {
    Write-Ok "$CLAUDE_DIR exists"
}

# Step 5: Update MCP config
Write-Step "`n[5/7] Configuring MCP server..."
$mcpConfig = Load-McpConfig -Path $MCP_CONFIG

if (-not ($mcpConfig.PSObject.Properties.Name -contains "mcpServers") -or $null -eq $mcpConfig.mcpServers) {
    $mcpConfig | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value ([pscustomobject]@{}) -Force
}

$mcpEntry = [pscustomobject]@{
    command = "node"
    args    = @($MCP_SERVER_PATH)
}

$mcpConfig.mcpServers | Add-Member -MemberType NoteProperty -Name "msw" -Value $mcpEntry -Force
$mcpConfig | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -Path $MCP_CONFIG
Write-Ok "MCP config updated at $MCP_CONFIG"

# Step 6: Verify installation
Write-Step "`n[6/7] Verifying installation..."
if (Test-Path $MCP_SERVER_PATH) {
    Write-Ok "MCP server built successfully"
}
else {
    Write-Fail "MCP server not found at $MCP_SERVER_PATH"
    exit 1
}

# Step 7: Authentication setup
Write-Step "`n[7/7] Authentication setup..."
Write-Host ""
Write-Host "  MSW requires Google authentication to access NotebookLM." -ForegroundColor White
Write-Host "  On first use, run " -NoNewline
Write-Host "msw_init" -ForegroundColor Cyan -NoNewline
Write-Host " in Claude Code." -ForegroundColor White
Write-Host "  This opens a browser for Google login and saves profile state." -ForegroundColor White
Write-Host ""

Write-Host "===============================================================" -ForegroundColor Green
Write-Host "                       Setup Complete                          " -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart your IDE (VS Code, Cursor, Windsurf, etc.)" -ForegroundColor White
Write-Host "  2. Open Claude Code" -ForegroundColor White
Write-Host "  3. Run msw_init in your project directory" -ForegroundColor White
Write-Host "  4. Follow the Google authentication prompt" -ForegroundColor White
Write-Host ""
Write-Host "Documentation: $MSW_DIR\SETUP.md" -ForegroundColor Gray
Write-Host ""

Set-Location $ORIGINAL_DIR
