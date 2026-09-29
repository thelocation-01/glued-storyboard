# Installation and troubleshooting

## First installation

1. Install Node.js 22 or newer and Python 3.12.
2. Download or clone Glued Storyboard.
3. Run `Setup-Glued-Storyboard.ps1` from PowerShell.
4. Wait for dependencies and the Kokoro model files to download and verify.
5. Double-click `Start-Glued-Storyboard.cmd`.

The app opens on the first free local port from 3210 to 3219.

## Verify the source checkout

```powershell
pnpm install --frozen-lockfile
pnpm verify
```

## Common problems

### Node.js is missing

Install a Node.js 22 release, close PowerShell, open it again, and rerun setup.

### Python environment creation fails

Install 64-bit Python 3.12 with the launcher enabled. Confirm `py -3.12 --version` works.

### Model hash verification fails

Delete the named model file inside `models\kokoro` and rerun setup. Do not bypass the hash check.

### The default port is busy

The launcher automatically checks ports 3210 through 3219. Close an old Glued process if all ten ports are occupied.

### Rendering is slow

Render the 24-second preview first. Close GPU-heavy applications and use fewer/lower-resolution source images during editing. The final 1080p render is intentionally more demanding.

## Uninstall

Back up any projects or rendered videos you want to keep, then remove the Glued Storyboard folder. Projects, model files, dependencies, and renders are stored inside that folder.

