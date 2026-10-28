# Startet einen einfachen lokalen Webserver fuer das Spiel: http://localhost:8080
# Zusaetzlich stellt er unter /api/scores eine gemeinsame Bestenliste bereit
# (gespeichert in data/scores.json).
# Mit -Public ist das Spiel auch von anderen Geraeten im Netz erreichbar
# (braucht Admin-Rechte oder eine URL-Reservierung, siehe README).
param(
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8080 }),
  [switch]$Public
)

$root = $PSScriptRoot
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'
}
$dataDir = Join-Path $root 'data'
$scoreFile = Join-Path $dataDir 'scores.json'
$keepScores = 100 # so viele Eintraege werden gespeichert, angezeigt werden die Top 10

function Read-Scores {
  if (-not (Test-Path $scoreFile)) { return , @() }
  # Als Argument statt per Pipeline, damit PowerShell 5.1 das Array nicht verschachtelt
  try { $list = ConvertFrom-Json (Get-Content $scoreFile -Raw -Encoding UTF8) } catch { return , @() }
  return , @($list | Where-Object { $_ })
}

function Send-Json($res, $value, [int]$status = 200) {
  $json = ConvertTo-Json -InputObject $value -Depth 4 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $res.StatusCode = $status
  $res.ContentType = 'application/json; charset=utf-8'
  $res.Headers.Add('Cache-Control', 'no-store')
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

# Das Komma verhindert, dass PowerShell leere oder einelementige Arrays bei der Rueckgabe auspackt
function Top10($list) { return , @($list | Select-Object -First 10 | Select-Object name, score, dist, level, date) }

function Handle-Scores($req, $res) {
  if ($req.HttpMethod -eq 'GET') {
    Send-Json $res (Top10 (Read-Scores))
    return
  }
  if ($req.HttpMethod -ne 'POST') { $res.StatusCode = 405; return }

  $reader = [IO.StreamReader]::new($req.InputStream, [Text.Encoding]::UTF8)
  $body = $reader.ReadToEnd()
  $reader.Dispose()
  try { $in = $body | ConvertFrom-Json } catch { $in = $null }
  $name = if ($in -and $in.name) { ([string]$in.name).Trim() } else { '' }
  if ($name.Length -gt 18) { $name = $name.Substring(0, 18) }
  $nums = foreach ($k in 'score', 'dist', 'level') { $v = 0.0; if ($in -and [double]::TryParse([string]$in.$k, [ref]$v)) { $v } else { -1 } }
  if (-not $name -or ($nums | Where-Object { $_ -lt 0 -or $_ -gt 1e9 })) {
    Send-Json $res @{ error = 'Ungueltiger Eintrag' } 400
    return
  }

  $id = [guid]::NewGuid().ToString()
  $entry = [pscustomobject]@{
    id = $id; name = $name
    score = [long]$nums[0]; dist = [long]$nums[1]; level = [int]$nums[2]
    date = (Get-Date).ToUniversalTime().ToString('o')
  }
  $old = Read-Scores
  $list = @(@($old) + $entry | Sort-Object -Property @{ Expression = { [double]$_.score }; Descending = $true } | Select-Object -First $keepScores)
  if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
  [IO.File]::WriteAllText($scoreFile, (ConvertTo-Json -InputObject $list -Depth 4), [Text.UTF8Encoding]::new($false))

  $rank = -1
  for ($i = 0; $i -lt [Math]::Min(10, $list.Count); $i++) { if ($list[$i].id -eq $id) { $rank = $i } }
  Send-Json $res @{ rank = $rank; scores = (Top10 $list) }
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($(if ($Public) { "http://+:$Port/" } else { "http://localhost:$Port/" }))
$listener.Start()
if ($Public) {
  Write-Host "dplan Data Runner: http://$([Net.Dns]::GetHostName()):$Port (im Netz erreichbar, Beenden mit Ctrl+C)"
} else {
  Write-Host "dplan Data Runner: http://localhost:$Port (Beenden mit Ctrl+C)"
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ($path -eq 'api/scores') {
        Handle-Scores $ctx.Request $res
        continue
      }
      if (-not $path) { $path = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $path))
      if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }
      if ($file.StartsWith($root) -and -not $file.StartsWith($dataDir + [IO.Path]::DirectorySeparatorChar) -and (Test-Path $file -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($file)
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
      }
    } catch {
      Write-Warning $_
      try { $res.StatusCode = 500 } catch { }
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
