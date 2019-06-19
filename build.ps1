<#
This script builds libctags
#>

$ErrorActionPreference = "Stop"
Import-Module Pscx

Set-Location $PSScriptRoot

Import-VisualStudioVars -VisualStudioVersion "140" -Architecture "x86"

Set-Location .\ctags-master
Start-Process -NoNewWindow -Wait nmake "-f mk_mvc.mak"
Set-Location ..

# Pushed by Import-VisualStudioVars
Pop-EnvironmentBlock