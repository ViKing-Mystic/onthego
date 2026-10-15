param([string]$htmlFile = "test_stage7.html")

$tempDir = Join-Path $env:TEMP ("edge_test_" + (Get-Random))
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$htmlUrl = "file:///d:/Documents/OntheGo/$htmlFile"
$outputFile = "d:\Documents\OntheGo\test_output.txt"
$errFile = Join-Path $env:TEMP "edge_err_$((Get-Random)).txt"

$proc = Start-Process -FilePath $edgePath `
    -ArgumentList "--headless=new --user-data-dir=`"$tempDir`" --disable-gpu --virtual-time-budget=8000 --dump-dom `"$htmlUrl`"" `
    -RedirectStandardOutput $outputFile `
    -RedirectStandardError $errFile `
    -PassThru -Wait -NoNewWindow

Remove-Item $errFile -Force -ErrorAction SilentlyContinue
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

$stdout = [System.IO.File]::ReadAllText($outputFile, [System.Text.Encoding]::UTF8)

$lines = $stdout -split "`n"
$resultLine = $lines | Where-Object { $_ -match '<div id="summary".*?\[.*?RESULT\]' }
$failLines = $lines | Where-Object { $_ -match '<span class="test-fail">' -or $_ -match '<div class="test-fail">' }

Write-Host "Result:" $resultLine
if ($failLines) {
    Write-Host "Failures:"
    $failLines | ForEach-Object { Write-Host "  " $_ }
} else {
    Write-Host "ALL TESTS PASSED!"
}
