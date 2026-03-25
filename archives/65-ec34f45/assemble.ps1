$metadata = Get-Content -Raw build-info.json | ConvertFrom-Json
foreach ($entry in $metadata.files) {
  if (-not $entry.split) { continue }

  $destination = Join-Path (Get-Location) $entry.name
  if (Test-Path $destination) {
    Remove-Item $destination
  }

  $stream = [System.IO.File]::Open($destination, [System.IO.FileMode]::CreateNew)
  try {
    foreach ($part in $entry.parts) {
      $bytes = [System.IO.File]::ReadAllBytes((Join-Path (Get-Location) $part.name))
      $stream.Write($bytes, 0, $bytes.Length)
    }
  }
  finally {
    $stream.Dispose()
  }

  Write-Host "assembled $($entry.name)"
}
