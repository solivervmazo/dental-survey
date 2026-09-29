$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host 'Open http://localhost:4173/dashboard/ in your browser.'
& node (Join-Path $projectRoot 'local-server.mjs')
