# Obsidian Plugin Auto Deploy Script
# 파일 변경 시 자동으로 Vault에 복사

$SOURCE_DIR = "C:\Users\gnbup\Desktop\Claude\wootech\Obsidian-sync-blog\Obsidian-sync-blog"
$VAULT_PLUGIN_DIR = "C:\Users\gnbup\OneDrive\Obsidian\.obsidian\plugins\obsidian-sync-blog"

Write-Host "=== Deploying Plugin to Obsidian ===" -ForegroundColor Cyan
Write-Host ""

# 파일 복사
$files = @("main.js", "manifest.json", "styles.css")

foreach ($file in $files) {
    $sourcePath = Join-Path $SOURCE_DIR $file
    $destPath = Join-Path $VAULT_PLUGIN_DIR $file
    
    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath -Destination $destPath -Force
        Write-Host "[OK] $file copied" -ForegroundColor Green
    } else {
        Write-Host "[SKIP] $file not found" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Please reload Obsidian to see changes." -ForegroundColor Cyan
