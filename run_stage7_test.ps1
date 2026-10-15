param([string]$htmlFile = "test_stage7.html")

$tempDir = Join-Path $env:TEMP ("edge_test_" + (Get-Random))
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$htmlUrl = "file:///d:/Documents/OntheGo/$htmlFile"
$outputFile = "d:\Documents\OntheGo\test_output.txt"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $edgePath
$psi.Arguments = "--headless=new --user-data-dir=`"$tempDir`" --disable-gpu --virtual-time-budget=8000 --dump-dom `"$htmlUrl`""
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$process = [System.Diagnostics.Process]::Start($psi)
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()

[System.IO.File]::WriteAllText($outputFile, $stdout, [System.Text.Encoding]::UTF8)

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
