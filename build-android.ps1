# ============================================================
# Capacitor Android Build Script
# Solves: Non-ASCII path (d:\项目1) + AGP AAPT2 v2.20 bug
# Strategy: Copy android/ + node_modules to ASCII path (C:\Users\Xu\travelbuild)
# Usage:
#   .\build-android.ps1 -BuildType debug          # Debug APK
#   .\build-android.ps1 -BuildType release        # Release APK
#   .\build-android.ps1 -BuildType release -AAB   # Release AAB (Google Play)
#   .\build-android.ps1 -BuildType release -Clean # Clean rebuild
# ============================================================
param(
    [string]$BuildType = "debug",
    [switch]$Clean,
    [switch]$AAB
)

$ErrorActionPreference = "Stop"

# Environment
$env:JAVA_HOME = "C:\Users\Xu\AppData\Local\jdk-21"
$env:ANDROID_HOME = "C:\Users\Xu\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = "C:\Users\Xu\AppData\Local\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

$PROJECT_DIR = "d:\项目1"
$BUILD_DIR = "C:\Users\Xu\travelbuild"

Write-Host "=== Capacitor Android Build ($BuildType) ===" -ForegroundColor Cyan

# Step 1: Sync web assets
Write-Host "`n[1/5] Syncing Capacitor..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR
npx cap sync android 2>&1 | Write-Host

# Step 2: Prepare ASCII build directory
Write-Host "`n[2/5] Preparing ASCII build directory..." -ForegroundColor Yellow
if ($Clean -and (Test-Path $BUILD_DIR)) {
    Remove-Item $BUILD_DIR -Force -Recurse -ErrorAction SilentlyContinue
}

# Copy android directory
if (-not (Test-Path $BUILD_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_DIR -Force | Out-Null
}
Copy-Item -Path "$PROJECT_DIR\android\*" -Destination $BUILD_DIR -Recurse -Force

# Copy node_modules (@capacitor + capacitor-secure-storage-plugin)
$nmDest = "$BUILD_DIR\node_modules"
if (-not (Test-Path "$nmDest\@capacitor")) {
    New-Item -ItemType Directory -Path "$nmDest\@capacitor" -Force | Out-Null
}
Copy-Item -Path "$PROJECT_DIR\node_modules\@capacitor\*" -Destination "$nmDest\@capacitor" -Recurse -Force
if (-not (Test-Path "$nmDest\capacitor-secure-storage-plugin")) {
    New-Item -ItemType Directory -Path "$nmDest\capacitor-secure-storage-plugin" -Force | Out-Null
}
Copy-Item -Path "$PROJECT_DIR\node_modules\capacitor-secure-storage-plugin\*" -Destination "$nmDest\capacitor-secure-storage-plugin" -Recurse -Force

# Copy keystore to parent directory (keystore.properties references ../travel-assistant.jks)
if (Test-Path "$PROJECT_DIR\travel-assistant.jks") {
    Copy-Item "$PROJECT_DIR\travel-assistant.jks" "C:\Users\Xu\travel-assistant.jks" -Force
    Write-Host "  Keystore copied to C:\Users\Xu\" -ForegroundColor DarkGray
}

# Step 3: Fix capacitor.settings.gradle paths
Write-Host "`n[3/5] Fixing paths..." -ForegroundColor Yellow
$settingsContent = @'
// Modified for ASCII-path build
include ':capacitor-android'
project(':capacitor-android').projectDir = new File('./node_modules/@capacitor/android/capacitor')
include ':capacitor-app'
project(':capacitor-app').projectDir = new File('./node_modules/@capacitor/app/android')
include ':capacitor-filesystem'
project(':capacitor-filesystem').projectDir = new File('./node_modules/@capacitor/filesystem/android')
include ':capacitor-geolocation'
project(':capacitor-geolocation').projectDir = new File('./node_modules/@capacitor/geolocation/android')
include ':capacitor-local-notifications'
project(':capacitor-local-notifications').projectDir = new File('./node_modules/@capacitor/local-notifications/android')
include ':capacitor-splash-screen'
project(':capacitor-splash-screen').projectDir = new File('./node_modules/@capacitor/splash-screen/android')
include ':capacitor-status-bar'
project(':capacitor-status-bar').projectDir = new File('./node_modules/@capacitor/status-bar/android')
include ':capacitor-secure-storage-plugin'
project(':capacitor-secure-storage-plugin').projectDir = new File('./node_modules/capacitor-secure-storage-plugin/android')
'@
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText("$BUILD_DIR\capacitor.settings.gradle", $settingsContent, $utf8NoBom)

# Step 4: Build
$outputType = if ($AAB) { "AAB" } else { "APK" }
Write-Host "`n[4/5] Building $BuildType $outputType..." -ForegroundColor Yellow
Set-Location $BUILD_DIR
if ($AAB) {
    $gradleTask = if ($BuildType -eq "release") { "bundleRelease" } else { "bundleDebug" }
} else {
    $gradleTask = if ($BuildType -eq "release") { "assembleRelease" } else { "assembleDebug" }
}
.\gradlew.bat $gradleTask --no-daemon --console=plain --max-workers=1 2>&1 | Write-Host

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBUILD FAILED!" -ForegroundColor Red
    exit 1
}

# Step 5: Copy output
Write-Host "`n[5/5] Copying output..." -ForegroundColor Yellow
if ($AAB) {
    $outputPath = Get-ChildItem "$BUILD_DIR\app\build\outputs\bundle\$BuildType" -Filter "*.aab" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($outputPath) {
        $destName = if ($BuildType -eq "release") { "app-release.aab" } else { "app-debug.aab" }
        Copy-Item $outputPath.FullName -Destination "$PROJECT_DIR\$destName" -Force
        $size = [math]::Round((Get-Item "$PROJECT_DIR\$destName").Length / 1MB, 2)
        Write-Host "AAB: $PROJECT_DIR\$destName ($size MB)" -ForegroundColor Green
    } else {
        Write-Host "AAB not found!" -ForegroundColor Red
        exit 1
    }
} else {
    $outputPath = Get-ChildItem "$BUILD_DIR\app\build\outputs\apk\$BuildType" -Filter "*.apk" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($outputPath) {
        $destName = if ($BuildType -eq "release") { "app-release.apk" } else { "app-debug.apk" }
        Copy-Item $outputPath.FullName -Destination "$PROJECT_DIR\$destName" -Force
        $size = [math]::Round((Get-Item "$PROJECT_DIR\$destName").Length / 1MB, 2)
        Write-Host "APK: $PROJECT_DIR\$destName ($size MB)" -ForegroundColor Green
    } else {
        Write-Host "APK not found!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n=== Build Complete ===" -ForegroundColor Cyan
