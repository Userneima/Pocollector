# Create desktop shortcut with icon for Redbook Tool
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = "$DesktopPath\Redbook Tool.lnk"
$TargetPath = "$PSScriptRoot\open-redbook.cmd"

# Use favicon.ico as the icon
$IconPath = "$PSScriptRoot\app\favicon.ico"

# Create shortcut
try {
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $TargetPath
    $Shortcut.WorkingDirectory = $PSScriptRoot
    
    # Set icon if it exists
    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = $IconPath
        Write-Host "Using icon: $IconPath"
    } else {
        Write-Host "No icon file found, using default icon"
    }
    
    $Shortcut.Save()
    Write-Host "Desktop shortcut created successfully: $ShortcutPath"
    Write-Host "You can now double-click 'Redbook Tool' on your desktop to start the application"
} catch {
    Write-Host "Error creating shortcut: $_"
}
