param(
  [string]$SkillsRoot = "$HOME/.agents/skills"
)

$skillName = "feishu-bitable-export"
$source = $PSScriptRoot
$target = Join-Path $SkillsRoot $skillName

if (Test-Path -LiteralPath $target) {
  throw "Refusing to replace existing skill: $target. Remove it manually or choose a different SkillsRoot."
}

New-Item -ItemType Directory -Force -Path $SkillsRoot | Out-Null
New-Item -ItemType SymbolicLink -Path $target -Target $source | Out-Null
Write-Output "Installed: $target"
