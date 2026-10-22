$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
$processes=@{};foreach($p in @(Get-CimInstance Win32_Process -Property ProcessId,Name,CommandLine,CreationDate)){$processes[[int]$p.ProcessId]=$p}
$services=@{};foreach($s in @(Get-CimInstance Win32_Service -Property ProcessId,Name,DisplayName -ErrorAction SilentlyContinue)){if($s.ProcessId -gt 0){$services[[int]$s.ProcessId]=@($services[[int]$s.ProcessId])+"$($s.DisplayName) ($($s.Name))"}}
$protected=@('system','idle','svchost','services','lsass','csrss','wininit','winlogon','smss','dwm','fontdrvhost','explorer','searchindexer','spoolsv','msmpeng','wudfhost','audiodg','taskhostw','sihost','ctfmon','runtimebroker','registry','secure system','memory compression')
$rows=@(foreach($c in @(Get-NetTCPConnection -State Listen)){$p=$processes[[int]$c.OwningProcess];$name=if($p){[IO.Path]::GetFileNameWithoutExtension($p.Name)}else{'unknown'};[pscustomobject]@{port=[int]$c.LocalPort;address=[string]$c.LocalAddress;pid=[int]$c.OwningProcess;name=$name;command=[string]$p.CommandLine;created=$(if($p.CreationDate){$p.CreationDate.ToUniversalTime().ToString('o')}else{''});service=($services[[int]$c.OwningProcess] -join ', ');protected=([int]$c.OwningProcess -le 4 -or $protected -contains $name.ToLower())}})
ConvertTo-Json -InputObject $rows -Depth 5 -Compress
