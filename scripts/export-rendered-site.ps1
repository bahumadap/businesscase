param(
  [string]$PageBaseUrl = "http://localhost:3100",
  [string]$ApiBaseUrl = "http://localhost:3000",
  [string]$OutputDirectory = "E:\Codex\Flujo-de-caja\YOL1_App_Renderizada_2026-08-24"
)

$ErrorActionPreference = "Stop"
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
$allowedParent = [IO.Path]::GetFullPath((Join-Path $projectRoot ".."))
if (-not $outputRoot.StartsWith($allowedParent, [StringComparison]::OrdinalIgnoreCase)) {
  throw "La carpeta de salida debe quedar dentro del workspace."
}
if (Test-Path -LiteralPath $outputRoot) {
  throw "La carpeta de salida ya existe: $outputRoot"
}

New-Item -ItemType Directory -Path $outputRoot | Out-Null

$clientAssets = Join-Path $projectRoot "dist\client"
if (-not (Test-Path -LiteralPath $clientAssets)) {
  throw "No existe el build de producción. Ejecuta npm run build primero."
}
Copy-Item -LiteralPath (Join-Path $clientAssets "_next") -Destination (Join-Path $outputRoot "_next") -Recurse
Get-ChildItem -LiteralPath $clientAssets -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $outputRoot $_.Name)
}

$routes = @("", "actuals", "assumptions", "audit", "b2c", "consolidated", "costs", "enterprise", "imports", "inputs", "opex", "products", "providers", "roadmap", "scenarios", "smb", "transversal", "verticals")
$navigationFix = @'
<script>
document.addEventListener("click", function (event) {
  var anchor = event.target.closest && event.target.closest("a[href]");
  if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
  var url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname.indexOf("/_next/") === 0) return;
  event.preventDefault();
  window.location.href = url.pathname + url.search + url.hash;
}, true);
</script>
'@

foreach ($route in $routes) {
  $uri = if ($route) { "$PageBaseUrl/$route" } else { "$PageBaseUrl/" }
  $html = (Invoke-WebRequest -UseBasicParsing -Uri $uri).Content
  $html = $html.Replace("</body>", "$navigationFix</body>")
  $destinationDirectory = if ($route) { Join-Path $outputRoot $route } else { $outputRoot }
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $destinationDirectory "index.html"), $html, [Text.UTF8Encoding]::new($false))
}

$apiDirectory = Join-Path $outputRoot "api"
New-Item -ItemType Directory -Path $apiDirectory | Out-Null
foreach ($apiName in @("enterprise", "b2c", "smb", "transversal", "opex", "providers", "actuals", "milestones", "audit")) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$ApiBaseUrl/api/$apiName"
    [IO.File]::WriteAllText((Join-Path $apiDirectory $apiName), $response.Content, [Text.UTF8Encoding]::new($false))
  } catch {
    [IO.File]::WriteAllText((Join-Path $apiDirectory $apiName), '{"plan":null,"logs":[]}', [Text.UTF8Encoding]::new($false))
  }
}

$serverScript = @'
param([switch]$NoBrowser)
$ErrorActionPreference = "Stop"
$siteRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$pidFile = Join-Path $siteRoot ".yol1-server.pid"
[IO.File]::WriteAllText($pidFile, [string]$PID)
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 8765)
$listener.Start()
if (-not $NoBrowser) { Start-Process "http://localhost:8765/" }

function Send-Response($stream, [int]$status, [string]$statusText, [string]$contentType, [byte[]]$body) {
  $header = "HTTP/1.1 $status $statusText`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      if (-not $requestLine) { continue }
      $parts = $requestLine.Split(" ")
      $method = $parts[0]
      $requestTarget = $parts[1]
      while (($line = $reader.ReadLine()) -ne $null -and $line -ne "") { }

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $body = [Text.Encoding]::UTF8.GetBytes('{"error":"Esta copia es de solo lectura"}')
        Send-Response $stream 405 "Method Not Allowed" "application/json; charset=utf-8" $body
        continue
      }

      $pathOnly = [Uri]::UnescapeDataString(($requestTarget -split "\?")[0]).TrimStart("/")
      $relative = $pathOnly.Replace("/", [IO.Path]::DirectorySeparatorChar)
      if (-not $relative) { $relative = "index.html" }
      $candidate = [IO.Path]::GetFullPath((Join-Path $siteRoot $relative))
      if (-not $candidate.StartsWith($siteRoot, [StringComparison]::OrdinalIgnoreCase)) {
        Send-Response $stream 403 "Forbidden" "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Forbidden"))
        continue
      }
      if (Test-Path -LiteralPath $candidate -PathType Container) { $candidate = Join-Path $candidate "index.html" }
      if (-not (Test-Path -LiteralPath $candidate -PathType Leaf) -and -not [IO.Path]::GetExtension($candidate)) {
        $candidate = Join-Path $candidate "index.html"
      }
      if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        Send-Response $stream 404 "Not Found" "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Not found"))
        continue
      }

      $extension = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
      $contentType = switch ($extension) {
        ".html" { "text/html; charset=utf-8" }
        ".css" { "text/css; charset=utf-8" }
        ".js" { "text/javascript; charset=utf-8" }
        ".json" { "application/json; charset=utf-8" }
        ".svg" { "image/svg+xml" }
        ".png" { "image/png" }
        ".woff2" { "font/woff2" }
        default { if ($relative.StartsWith("api")) { "application/json; charset=utf-8" } else { "application/octet-stream" } }
      }
      $body = if ($method -eq "HEAD") { [byte[]]::new(0) } else { [IO.File]::ReadAllBytes($candidate) }
      Send-Response $stream 200 "OK" $contentType $body
    } catch {
      try { Send-Response $stream 500 "Internal Server Error" "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Server error")) } catch { }
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
  Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
}
'@
[IO.File]::WriteAllText((Join-Path $outputRoot "servidor.ps1"), $serverScript, [Text.UTF8Encoding]::new($false))

$openBatch = @'
@echo off
cd /d "%~dp0"
start "YOL1 Demo" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0servidor.ps1"
'@
[IO.File]::WriteAllText((Join-Path $outputRoot "ABRIR_YOL1.bat"), $openBatch, [Text.ASCIIEncoding]::new())

$closeBatch = @'
@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$id = Get-Content -LiteralPath '%~dp0.yol1-server.pid' -ErrorAction SilentlyContinue; if ($id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }; Remove-Item -LiteralPath '%~dp0.yol1-server.pid' -ErrorAction SilentlyContinue"
'@
[IO.File]::WriteAllText((Join-Path $outputRoot "CERRAR_YOL1.bat"), $closeBatch, [Text.ASCIIEncoding]::new())

$readme = @'
YOL1 · PLANIFICACIÓN FINANCIERA · COPIA RENDERIZADA

1. Descomprime la carpeta completa.
2. Haz doble clic en ABRIR_YOL1.bat.
3. La aplicación se abrirá en Chrome o Edge con el diseño original.
4. Para cerrar el servidor local, ejecuta CERRAR_YOL1.bat.

Esta copia incluye los HTML realmente renderizados, los estilos, fuentes y JavaScript originales.
Es una versión local de presentación: permite navegar y usar pestañas, pero no guarda ediciones.
No requiere internet ni instalar Node.js.
'@
[IO.File]::WriteAllText((Join-Path $outputRoot "LEEME.txt"), $readme, [Text.UTF8Encoding]::new($false))

Write-Output $outputRoot
