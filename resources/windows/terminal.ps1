param([Parameter(Mandatory=$true)][string]$Folder)
$ErrorActionPreference='Stop'
# PowerShell startup can reset its location when the OS cwd contains wildcard characters.
Set-Location -LiteralPath $Folder
