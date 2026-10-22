param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($Path,[ref]$null,[ref]$errors)
if($errors.Count){throw $errors[0].Message}
$lines=@(Get-Content -LiteralPath $Path -Encoding UTF8);$rows=@();$skipped=@();$category='Imported';$line=0
foreach($fn in $ast.EndBlock.Statements){if($fn -isnot [Management.Automation.Language.FunctionDefinitionAst]){continue};while($line -lt $fn.Extent.StartLineNumber-1){if($lines[$line] -match '^\s*#\s*-{2,}\s*(.+?)\s*-{2,}\s*$'){$category=$Matches[1]};$line++}
 $body=$fn.Body;$statements=@($body.EndBlock.Statements);$cmd=$null
 if($statements.Count -eq 1 -and $statements[0] -is [Management.Automation.Language.PipelineAst] -and $statements[0].PipelineElements.Count -eq 1){$cmd=$statements[0].PipelineElements[0]}
 if(-not $body.ParamBlock -and -not $body.BeginBlock -and -not $body.ProcessBlock -and -not $body.DynamicParamBlock -and -not $body.CleanBlock -and -not $body.Traps.Count -and -not $body.EndBlock.Traps.Count -and $cmd -is [Management.Automation.Language.CommandAst] -and $cmd.GetCommandName() -eq 'Set-Location' -and -not $cmd.Redirections.Count -and $cmd.CommandElements.Count -in @(2,3) -and $cmd.CommandElements[-1] -is [Management.Automation.Language.StringConstantExpressionAst] -and ($cmd.CommandElements.Count -eq 2 -or ($cmd.CommandElements[1] -is [Management.Automation.Language.CommandParameterAst] -and $cmd.CommandElements[1].ParameterName -in @('Path','LiteralPath') -and -not $cmd.CommandElements[1].Argument))){
  $rows += [pscustomobject]@{label=$fn.Name;shellName=$fn.Name;path=$cmd.CommandElements[-1].Value;group=$category}
 }else{$skipped+="$($fn.Name): executable command function retained in original file"};$line=$fn.Extent.EndLineNumber
}
ConvertTo-Json -InputObject @{rows=@($rows);skipped=@($skipped)} -Depth 6 -Compress
