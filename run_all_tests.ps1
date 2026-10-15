$testFiles = @(
    "test_production_verification.html",
    "test_stage2.html",
    "test_stage3.html",
    "test_stage4.html",
    "test_stage5.html",
    "test_stage7.html"
)

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$baseDir = "d:\Documents\OntheGo"

foreach ($file in $testFiles) {
    $tempDir = Join-Path $env:TEMP ("edge_test_" + (Get-Random))
    $url = "file:///$baseDir/$file"
    
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $edgePath
    $psi.Arguments = "--headless=new --user-data-dir=`"$tempDir`" --disable-gpu --virtual-time-budget=8000 --dump-dom `"$url`""
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $process = [System.Diagnostics.Process]::Start($psi)
    $stdout = $process.StandardOutput.ReadToEnd()
    $process.WaitForExit()

    $summaryMatch = [regex]::Match($stdout, "\[(?:STAGE \d+|PRODUCTION VERIFICATION)[^\]]*RESULT\][^<]+")
    if ($summaryMatch.Success) {
        Write-Host "[$file] -> $($summaryMatch.Value)" -ForegroundColor Green
    } else {
        $lines = $stdout -split "`n"
        $summaryLine = $lines | Where-Object { $_ -match "PASSED" -or $_ -match "summary" } | Select-Object -First 1
        Write-Host "[$file] -> $summaryLine" -ForegroundColor Yellow
    }
}
