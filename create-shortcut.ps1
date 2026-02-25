# Create desktop shortcut for Redbook Tool
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = "$DesktopPath\Redbook Tool.lnk"
$TargetPath = "$PSScriptRoot\open-redbook.cmd"

# Create shortcut
try {
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $TargetPath
    $Shortcut.WorkingDirectory = $PSScriptRoot
    $Shortcut.Save()
    Write-Host "Desktop shortcut created successfully: $ShortcutPath"
    Write-Host "You can now double-click 'Redbook Tool' on your desktop to start the application"
} catch {
    Write-Host "Error creating shortcut: $_"
}
