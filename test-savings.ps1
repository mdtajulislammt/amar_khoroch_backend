$ErrorActionPreference = "Stop"

# Step 1: Register a test user
Write-Host "=== Step 1: Registering test user ===" -ForegroundColor Cyan
try {
    $body = @{ email = "savingstest@example.com"; password = "Test1234!"; name = "Savings Test" } | ConvertTo-Json
    $reg = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/auth/register" -Method POST -ContentType "application/json" -Body $body
    $token = $reg.data.token
    Write-Host "Registered OK. Token: $($token.Substring(0,20))..." -ForegroundColor Green
} catch {
    Write-Host "Register failed (user may exist), trying login..." -ForegroundColor Yellow
    $body = @{ email = "savingstest@example.com"; password = "Test1234!" } | ConvertTo-Json
    $reg = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body
    $token = $reg.data.token
    Write-Host "Login OK. Token: $($token.Substring(0,20))..." -ForegroundColor Green
}

$headers = @{ Authorization = "Bearer $token" }

# Step 2: Create a saving goal
Write-Host "`n=== Step 2: Create Saving Goal ===" -ForegroundColor Cyan
$goalBody = @{ goalName = "Test Goal"; targetAmount = 10000; currentAmount = 0 } | ConvertTo-Json
try {
    $created = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/savings" -Method POST -ContentType "application/json" -Headers $headers -Body $goalBody
    Write-Host "Created Goal: $($created | ConvertTo-Json -Depth 3)" -ForegroundColor Green
    $goalId = $created.data.id
} catch {
    Write-Host "Create failed: $_" -ForegroundColor Red
    exit
}

# Step 3: Get savings list
Write-Host "`n=== Step 3: Get Savings Goals ===" -ForegroundColor Cyan
try {
    $list = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/savings" -Headers $headers
    Write-Host "Savings List: $($list | ConvertTo-Json -Depth 3)" -ForegroundColor Green
} catch {
    Write-Host "Get savings failed: $_" -ForegroundColor Red
}

# Step 4: Get wallets
Write-Host "`n=== Step 4: Get Wallets ===" -ForegroundColor Cyan
try {
    $wallets = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/wallets" -Headers $headers
    Write-Host "Wallets: $($wallets | ConvertTo-Json -Depth 3)" -ForegroundColor Green
    $walletId = $wallets.data[0].id
    if (!$walletId) {
        Write-Host "No wallets found, creating one..." -ForegroundColor Yellow
        $wBody = @{ name = "Test Wallet"; type = "CASH"; balance = 50000; icon = "Wallet" } | ConvertTo-Json
        $wRes = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/wallets" -Method POST -ContentType "application/json" -Headers $headers -Body $wBody
        $walletId = $wRes.data.id
        Write-Host "Wallet created: $walletId" -ForegroundColor Green
    }
} catch {
    Write-Host "Get wallets failed: $_" -ForegroundColor Red
}

# Step 5: Deposit into saving
Write-Host "`n=== Step 5: Deposit into Saving Goal ===" -ForegroundColor Cyan
try {
    $depositBody = @{ amount = 1000; walletId = $walletId } | ConvertTo-Json
    $deposit = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/savings/$goalId/deposit" -Method POST -ContentType "application/json" -Headers $headers -Body $depositBody
    Write-Host "Deposit Result: $($deposit | ConvertTo-Json -Depth 3)" -ForegroundColor Green
} catch {
    Write-Host "Deposit failed: $_" -ForegroundColor Red
}

# Step 6: Get saving history (THE KEY TEST)
Write-Host "`n=== Step 6: Get Saving History ===" -ForegroundColor Cyan
try {
    $hist = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/savings/history" -Headers $headers
    Write-Host "History: $($hist | ConvertTo-Json -Depth 3)" -ForegroundColor Green
} catch {
    Write-Host "Get history FAILED: $_" -ForegroundColor Red
}

# Step 7: Get saving history filtered by goal
Write-Host "`n=== Step 7: Get History by savingId ===" -ForegroundColor Cyan
try {
    $hist2 = Invoke-RestMethod -Uri "http://localhost:9898/api/v1/savings/history?savingId=$goalId" -Headers $headers
    Write-Host "Filtered History: $($hist2 | ConvertTo-Json -Depth 3)" -ForegroundColor Green
} catch {
    Write-Host "Filtered history FAILED: $_" -ForegroundColor Red
}

Write-Host "`n=== All Tests Done ===" -ForegroundColor Cyan
