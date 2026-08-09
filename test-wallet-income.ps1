$ErrorActionPreference = "Stop"

Write-Host "=== Testing Wallet Auto-Income Transaction ===" -ForegroundColor Cyan

# Register or login
try {
    $body = @{ email = "wtest2@ex.com"; password = "Test1234!"; name = "Wallet Test" } | ConvertTo-Json
    $reg = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/auth/register" -Method POST -ContentType "application/json" -Body $body
    $token = $reg.data.token
    Write-Host "Registered. Token OK" -ForegroundColor Green
} catch {
    try {
        $body = @{ email = "wtest2@ex.com"; password = "Test1234!" } | ConvertTo-Json
        $reg = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body
        $token = $reg.data.token
        Write-Host "Logged in. Token OK" -ForegroundColor Green
    } catch {
        Write-Host "Auth failed: $_" -ForegroundColor Red
        exit
    }
}

$headers = @{ Authorization = "Bearer $token" }

# Create wallet with initial balance
Write-Host "`n--- Creating wallet with balance 25000 ---" -ForegroundColor Yellow
$wBody = @{ name = "My Cash"; type = "CASH"; balance = 25000; icon = "CASH" } | ConvertTo-Json
try {
    $w = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/wallets" -Method POST -ContentType "application/json" -Headers $headers -Body $wBody
    Write-Host "Wallet created: $($w.data.name), balance: $($w.data.balance)" -ForegroundColor Green
} catch {
    Write-Host "Create wallet failed: $_" -ForegroundColor Red
    exit
}

# Check transactions
Write-Host "`n--- Checking transactions ---" -ForegroundColor Yellow
$tx = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/transactions" -Headers $headers
Write-Host "Total transactions: $($tx.pagination.total)" -ForegroundColor Cyan
foreach ($t in $tx.data) {
    Write-Host "  TX: type=$($t.type) amount=$($t.amount) note=$($t.note)" -ForegroundColor White
}

# Check categories (Initial Balance should be there)
Write-Host "`n--- Checking categories ---" -ForegroundColor Yellow
$cats = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/categories" -Headers $headers
foreach ($c in $cats.data) {
    Write-Host "  Cat: name=$($c.name) type=$($c.type)" -ForegroundColor White
}
