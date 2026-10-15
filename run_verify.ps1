param([string]$htmlFile = "test_production_verification.html")

$tempDir = Join-Path $env:TEMP ("edge_test_" + (Get-Random))
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$htmlUrl = "file:///d:/Documents/OntheGo/$htmlFile"
$outputFile = "d:\Documents\OntheGo\verify_out.txt"
$errFile = "d:\Documents\OntheGo\verify_err.txt"

if (Test-Path $outputFile) { Remove-Item $outputFile -Force }
if (Test-Path $errFile) { Remove-Item $errFile -Force }

$proc = Start-Process -FilePath $edgePath `
    -ArgumentList "--headless=new --user-data-dir=`"$tempDir`" --disable-gpu --virtual-time-budget=8000 --dump-dom `"$htmlUrl`"" `
    -RedirectStandardOutput $outputFile `
    -RedirectStandardError $errFile `
    -PassThru

$finished = $proc.WaitForExit(35000)
if (-not $finished) {
    Write-Host "Process did not exit in 35s, killing..."
    $proc.Kill()
}

Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

$stdout = ""
if (Test-Path $outputFile) {
    $stdout = [System.IO.File]::ReadAllText($outputFile, [System.Text.Encoding]::UTF8)
}

$lines = $stdout -split "`n"
$resultLine = $lines | Where-Object { $_ -match '<div id="summary".*?\[.*?RESULT\]' }
$failLines = $lines | Where-Object { $_ -match '<span class="test-fail">' -or $_ -match '<div class="test-fail">' }
$passLines = $lines | Where-Object { $_ -match '<span class="test-pass">' }

Write-Host "Result:" $resultLine
Write-Host "Passed count:" $passLines.Count
if ($failLines) {
    Write-Host "Failures:"
    $failLines | ForEach-Object { Write-Host "  " $_ }
}

if (Test-Path $outputFile) { Remove-Item $outputFile -Force }
if (Test-Path $errFile) { Remove-Item $errFile -Force }
