$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path ([System.IO.Path]::Combine($PSScriptRoot, "..", ".."))
$crateDir = [System.IO.Path]::Combine($repoRoot, "vendor", "osm2streets", "osm2streets-js")
$outDir = [System.IO.Path]::Combine($repoRoot, "prototype", "vendor", "osm2streets-js")

if (!(Get-Command wasm-pack -ErrorAction SilentlyContinue)) {
  $cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
  if (Test-Path (Join-Path $cargoBin "wasm-pack.exe")) {
    $env:Path = "$cargoBin;$env:Path"
  }
}

if (!(Get-Command wasm-pack -ErrorAction SilentlyContinue)) {
  throw "wasm-pack was not found. Install Rust, run 'rustup target add wasm32-unknown-unknown', then 'cargo install wasm-pack --locked'."
}

if (Test-Path $outDir) {
  Remove-Item -LiteralPath $outDir -Recurse -Force
}

Push-Location $crateDir
try {
  wasm-pack build --release --target web --out-dir "..\..\..\prototype\vendor\osm2streets-js"
}
finally {
  Pop-Location
}

$generatedIgnore = Join-Path $outDir ".gitignore"
if (Test-Path $generatedIgnore) {
  Remove-Item -LiteralPath $generatedIgnore -Force
}

Write-Host "osm2streets WASM package built at $outDir"
