param([Parameter(Mandatory=$true)][int]$Port,[Parameter(Mandatory=$true)][string]$Address,[Parameter(Mandatory=$true)][int]$Owner,[Parameter(Mandatory=$true)][string]$Created,[Parameter(Mandatory=$true)][int]$LauncherPid)
$ErrorActionPreference='Stop'
$rows=@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -eq $Address })
if(-not @($rows | Where-Object OwningProcess -eq $Owner).Count){throw 'Port owner changed. Inspect again.'}
$process=Get-CimInstance Win32_Process -Filter "ProcessId=$Owner"
if(-not $process -or -not $process.CreationDate -or $process.CreationDate.ToUniversalTime().ToString('o') -cne $Created){throw 'Process identity changed. Inspect again.'}
$protected=@('system','idle','svchost','services','lsass','csrss','wininit','winlogon','smss','dwm','fontdrvhost','explorer','searchindexer','spoolsv','msmpeng','wudfhost','audiodg','taskhostw','sihost','ctfmon','runtimebroker','registry','secure system','memory compression')
$name=[IO.Path]::GetFileNameWithoutExtension($process.Name).ToLower()
if($Owner -le 4 -or $Owner -eq $LauncherPid -or $Owner -eq $PID -or $protected -contains $name){throw 'Protected process. Stop refused.'}
# Use the same retained kernel handle for identity and termination, even if a PID is reused.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LauncherNative {
 [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access, bool inherit, int id);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool GetProcessTimes(IntPtr handle, out long created, out long exited, out long kernel, out long user);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool TerminateProcess(IntPtr handle, uint code);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
}
'@
$handle=[LauncherNative]::OpenProcess(0x1001,$false,$Owner)
if($handle -eq [IntPtr]::Zero){throw (New-Object ComponentModel.Win32Exception([Runtime.InteropServices.Marshal]::GetLastWin32Error()))}
try {
 [long]$createdTime=0;[long]$exitTime=0;[long]$kernelTime=0;[long]$userTime=0
 if(-not [LauncherNative]::GetProcessTimes($handle,[ref]$createdTime,[ref]$exitTime,[ref]$kernelTime,[ref]$userTime)){throw (New-Object ComponentModel.Win32Exception([Runtime.InteropServices.Marshal]::GetLastWin32Error()))}
 if([Math]::Abs([DateTime]::FromFileTimeUtc($createdTime).Ticks - $process.CreationDate.ToUniversalTime().Ticks) -gt 10){throw 'Process changed during confirmation.'}
 if(-not [LauncherNative]::TerminateProcess($handle,1)){throw (New-Object ComponentModel.Win32Exception([Runtime.InteropServices.Marshal]::GetLastWin32Error()))}
} finally { [void][LauncherNative]::CloseHandle($handle) }
ConvertTo-Json -InputObject @{ok=$true} -Compress
