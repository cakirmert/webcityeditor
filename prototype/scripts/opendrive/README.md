# OpenDRIVE to CityGML trial

This is the first script-backed r:trån import slice. It validates a directory of
`.xodr` files and then converts the same directory to CityGML. Importing the
result into the browser is still a later task.

## Pinned tool setup

- r:trån: `1.3.0`
- Java: `11` or newer
- JAR URL: <https://github.com/tum-gis/rtron/releases/download/v1.3.0/rtron-1.3.0.jar>
- Default local path: `tools/rtron-1.3.0/rtron-1.3.0.jar` from the repository root

The `tools/` directory is ignored by Git. On Windows, create the default folder
and download the pinned JAR:

```powershell
New-Item -ItemType Directory -Force ..\tools\rtron-1.3.0 | Out-Null
Invoke-WebRequest `
  -Uri https://github.com/tum-gis/rtron/releases/download/v1.3.0/rtron-1.3.0.jar `
  -OutFile ..\tools\rtron-1.3.0\rtron-1.3.0.jar
```

## Run

From `prototype/`, inspect the exact commands and paths without writing files:

```powershell
npm run opendrive:rtron -- ..\Data\opendrive --dry-run
```

Run validation followed by conversion:

```powershell
npm run opendrive:rtron -- ..\Data\opendrive
```

The default outputs are sibling folders under `Data/rtron-output/reports` and
`Data/rtron-output/citygml`. Use `--output-dir`, `--reports-dir`, or
`--citygml-dir` to override them. Use `--java` or `--rtron-jar` when the pinned
tools are installed elsewhere.

The runner fails before creating output when the input directory or JAR is
missing, or when Java is older than 11. A successful conversion still needs a
small licensed or generated `.xodr` fixture before the CityGML structure and
lane-semantics preservation can be verified.
