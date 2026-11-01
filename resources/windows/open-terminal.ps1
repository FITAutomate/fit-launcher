param(
    [Parameter(Mandatory=$true)][string]$Folder,
    [Parameter(Mandatory=$true)][string]$Bootstrap
)
$ErrorActionPreference='Stop'
if (-not (Get-Item -LiteralPath $Folder).PSIsContainer) { throw 'Terminal folder is not a directory.' }
if (-not (Test-Path -LiteralPath $Bootstrap -PathType Leaf)) { throw 'Terminal helper is missing.' }

# ShellExecute needs a Windows argument string, not PowerShell command text.
# Quote each value, including trailing backslashes such as a drive root.
function Quote-WindowsArgument([string]$Value) {
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}
$start = New-Object System.Diagnostics.ProcessStartInfo
$start.FileName = Join-Path $PSHOME 'powershell.exe'
$start.Arguments = '-NoExit -ExecutionPolicy Bypass -File ' + (Quote-WindowsArgument $Bootstrap) + ' -Folder ' + (Quote-WindowsArgument $Folder)
$start.WorkingDirectory = $Folder
# Do not inherit the GUI launcher's ignored stdin/stdout handles. Windows opens
# a normal interactive console using its configured console host.
$start.UseShellExecute = $true
$start.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Normal
$child = [System.Diagnostics.Process]::Start($start)
try {
    Start-Sleep -Milliseconds 500
    $child.Refresh()
    if ($child.HasExited) { throw 'PowerShell closed during startup.' }
    @{pid=$child.Id} | ConvertTo-Json -Compress
} finally {
    $child.Dispose()
}
