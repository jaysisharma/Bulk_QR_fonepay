@echo off
setlocal enabledelayedexpansion
title QR Studio - Windows Folder Splitter (132 per Folder)

echo ============================================================
echo        QR Studio - 132 Bulk Folder Splitter (Windows)
echo ============================================================
echo.
echo Opening Windows Folder Picker dialog...
echo Please select the folder containing your 500+ files.
echo.

:: Use PowerShell to open native Windows FolderBrowserDialog
set "PS_CMD=Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select folder containing files to split into 132 batches'; $f.ShowNewFolderButton = $false; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "%PS_CMD%"`) do set "SOURCE_DIR=%%I"

if "%SOURCE_DIR%"=="" (
    echo [INFO] No folder was selected. Exiting.
    pause
    exit /b 0
)

echo [OK] Selected Folder: "%SOURCE_DIR%"
echo.

set "BATCH_SIZE=132"
set /p "USER_BATCH=Enter max files per folder [Press ENTER for default 132]: "
if not "%USER_BATCH%"=="" set "BATCH_SIZE=%USER_BATCH%"

echo.
echo How would you like to process the files?
echo   [1] Move files (Auto-clean source folder into 132 batches) [Default]
echo   [2] Copy files (Keep duplicate copies in source folder)
set "MODE_CHOICE=1"
set /p "MODE_INPUT=Choose [1 or 2, Press ENTER for default 1]: "
if "%MODE_INPUT%"=="2" set "MODE_CHOICE=2"

echo.
echo Splitting files into batches of %BATCH_SIZE%...
echo.

:: Run PowerShell script to perform natural sorting, folder creation and file distribution
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$source = '%SOURCE_DIR%';" ^
    "$batchSize = %BATCH_SIZE%;" ^
    "$isMove = ('%MODE_CHOICE%' -eq '1');" ^
    "$destRoot = Join-Path $source ('Batches_' + $batchSize);" ^
    "if (-not (Test-Path $destRoot)) { New-Item -ItemType Directory -Path $destRoot | Out-Null }" ^
    "$files = Get-ChildItem -LiteralPath $source -File | Where-Object { -not $_.Name.StartsWith('.') -and $_.Name -ne 'Thumbs.db' };" ^
    "if ($files.Count -eq 0) { Write-Host 'No files found in folder.' -ForegroundColor Yellow; exit }" ^
    "$sortedFiles = $files | Sort-Object { [regex]::Replace($_.Name, '\d+', { $args[0].Value.PadLeft(20, '0') }) };" ^
    "function Get-LetterLabel($idx) {" ^
    "    $res = '';" ^
    "    while ($true) {" ^
    "        $rem = $idx %% 26;" ^
    "        $res = [char](65 + $rem) + $res;" ^
    "        if ($idx -lt 26) { break };" ^
    "        $idx = [math]::Floor($idx / 26) - 1;" ^
    "    }" ^
    "    return $res" ^
    "};" ^
    "$total = $sortedFiles.Count;" ^
    "$batchCount = [math]::Ceiling($total / $batchSize);" ^
    "Write-Host ('Found ' + $total + ' files. Creating ' + $batchCount + ' batch folders (max ' + $batchSize + ' files each)...') -ForegroundColor Cyan;" ^
    "for ($b = 0; $b -lt $batchCount; $b++) {" ^
    "    $letter = Get-LetterLabel $b;" ^
    "    $start = $b * $batchSize + 1;" ^
    "    $end = [math]::Min($total, ($b + 1) * $batchSize);" ^
    "    $folderName = 'Batch_' + $letter;" ^
    "    $targetDir = Join-Path $destRoot $folderName;" ^
    "    if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir | Out-Null }" ^
    "    $chunk = $sortedFiles[($start - 1)..($end - 1)];" ^
    "    foreach ($f in $chunk) {" ^
    "        $destFile = Join-Path $targetDir $f.Name;" ^
    "        if ($isMove) { Move-Item -LiteralPath $f.FullName -Destination $destFile -Force }" ^
    "        else { Copy-Item -LiteralPath $f.FullName -Destination $destFile -Force }" ^
    "    }" ^
    "    Write-Host ('  [+] ' + $folderName.PadRight(15) + ' : ' + $chunk.Count + ' files (#' + $start + ' to #' + $end + ')') -ForegroundColor Green;" ^
    "};" ^
    "Write-Host '';" ^
    "Write-Host ('[SUCCESS] Successfully organized ' + $total + ' files into ' + $batchCount + ' folders!') -ForegroundColor Green;" ^
    "Write-Host ('Location: ' + $destRoot) -ForegroundColor Yellow;" ^
    "Start-Process explorer.exe -ArgumentList ('\""' + $destRoot + '\""');"

echo.
echo ============================================================
echo Process Complete! Output folder has been opened in Explorer.
echo ============================================================
echo.
pause
