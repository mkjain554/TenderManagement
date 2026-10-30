# Tender Desk

A local-first tender and bill management desktop app built with React, Vite, Electron and SQLite. It does not use a cloud service, remote API, or separate backend server.

## Requirements

- Node.js 22.12+
- npm
- On macOS, Windows, or Linux. Building installers for a different operating system generally requires building on that OS.

## Developer setup guide

Open a terminal in the project folder and install the dependencies:

```bash
npm install
```

Start the desktop app in development mode:

```bash
npm run dev
```

`npm install` rebuilds the SQLite native module for Electron. On systems without a matching prebuilt native binary, the platform's C/C++ build tools may also be required.

## Build installers

Build the installer for the operating system you are currently using:

```bash
# Windows installer (.exe)
npm run dist -- --win nsis

# macOS disk image (.dmg)
npm run dist -- --mac dmg
```

Build the Windows installer on Windows and the macOS DMG on macOS for the most reliable results. Node.js and npm are needed to build; the client does not need them to install or run the finished application.

Installers are written to the `release/` folder. To build only the web-renderer assets without an installer, run:

```bash
npm run build
```

## First login

- Username: `admin`
- Password: `admin123`

The MVP seeds this local account in SQLite. Password management is not included yet, so secure access to the computer account that stores the app's data.

## Local data and privacy

Electron stores the application's data under the operating system's per-user application-data directory, in a `data/` subdirectory:

To open the folder in Finder, choose Go → Go to Folder… and enter:
~/Library/Application Support/Tender Desk/data/


- `data/database.sqlite`
- `data/tenders/{tender-id}/documents/`
- `data/tenders/{tender-id}/bills/{bill-id}/`

Tender and bill identifiers are generated independently of their names. SQLite stores file metadata and relative paths; uploaded file contents remain on disk. Database access and filesystem operations happen only in Electron's main process. The renderer receives a narrow, allowlisted API through an isolated preload script.

## Notes

- Tender and bill lists are paginated.
- Tender records include project/work references, work code, quoted rate and rebate, project dates and extensions, bank guarantees with linked FDR/Insurance security-instrument details and release dates. The application-generated tender ID remains separate and is used for local file folders.
- Tender list search also matches the official tender ID, department, location and work-order number. Existing databases are updated additively when the app starts; existing tenders are retained and marked "Not set" for the new status.
- The tender list separates allotted tenders (Awarded, In progress or Completed) from participated tenders (all other statuses). Participated records show tender fees and EMD amounts/refunds; record the actual EMD refund received when editing a tender. Refunds cannot exceed the EMD amount. Select a Financial Year to limit the list and construction-bill totals to tenders with bills in that year.
- A tender can have multiple named projects and an Apply GST option. Each bill is assigned to one of its tender's projects; when GST is enabled, CGST and SGST are included in bill deductions. Existing tender names are migrated as their initial project name, and existing bills retain that project assignment.
- Bank guarantee details and one shared FDR/Insurance security-instrument record are entered together for each guarantee. Add multiple linked records as needed and record the guarantee and instrument release dates. Existing FDR and insurance details are migrated into the shared fields, preferring existing FDR values when both were entered.
- Project completion records track total Security deductions from that project's bills, the refund, editable remaining balance, remarks, and attached closeout documents.
- When uploading tender or bill documents, enter a short label of 1–10 letters, numbers, spaces, hyphens or underscores. The label is stored with the original filename; uploaded files remain in their existing local folders.
- Outstanding amount is calculated as `max(0, tender bidding amount - total amount received)`.
- Bills are categorized as Construction bills or Maintenance bills, with separate tabs and financial totals for each category. Maintenance bills are excluded from the construction contract balance, construction received/hold totals, and tender completion security amount. Older bill types are migrated to Construction bill so existing records are retained. Select a Financial Year for each bill; existing bills are assigned a year from their bill date during migration. Bills include editable percentage rates and deductions, previous-bill references and deductions, hold/release dates and remarks, payment reference fields, and a live gross/deduction/net-payable calculation. The displayed starter rates are editable and should be checked against the applicable contract. Existing local databases receive additive schema migrations when the app starts.
- Bill rows provide a file popup with each document's short name and upload date/time, plus local view and save-copy actions. Each tender details page can print a project billing-status statement with bill totals and signature lines; it is an internal record, not a tax invoice.
- Tender names are unique without regard to letter case.
- Local document open uses the operating system's default application. Missing or moved files are reported in the app.


## Windows: recover from an uninstall integrity error

The NSIS "Installer integrity check has failed" message means Windows could not verify the installer or uninstaller executable. If it appears while uninstalling Tender Desk, the installed uninstaller may be damaged. The steps below remove the app files and its matching per-user uninstall entry without deleting tender records.

1. Close Tender Desk. Before troubleshooting or reinstalling, back up important records from `%AppData%\tender-desk\data` or use the app's backup feature if it still opens. **Do not remove `%AppData%\tender-desk`; it contains the SQLite database and tender and bill documents.**
2. Open PowerShell as the Windows user who installed the app and run:

```powershell
$ErrorActionPreference = 'Stop'

# Stop the app if it is still running.
Get-Process -Name 'Tender Desk' -ErrorAction SilentlyContinue | Stop-Process -Force

# Remove the per-user app install and any staged update files.
$appFolders = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\tender-desk'),
  (Join-Path $env:LOCALAPPDATA 'tender-desk-updated')
)
foreach ($folder in $appFolders) {
  if (Test-Path -LiteralPath $folder) {
    Remove-Item -LiteralPath $folder -Recurse -Force
    Write-Host "Removed app folder: $folder"
  }
}

# Remove only uninstall registry entries whose display name is Tender Desk.
$uninstallRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
if (Test-Path $uninstallRoot) {
  Get-ChildItem -LiteralPath $uninstallRoot | ForEach-Object {
    $entry = Get-ItemProperty -LiteralPath $_.PSPath
    if ($entry.DisplayName -match '^Tender Desk(?:\s|$)') {
      Remove-Item -LiteralPath $_.PSPath -Recurse -Force
      Write-Host "Removed uninstall entry: $($entry.DisplayName)"
    }
  }
}

# Remove app shortcuts, if present.
$shortcuts = @(
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Tender Desk.lnk'),
  (Join-Path $env:USERPROFILE 'Desktop\Tender Desk.lnk')
)
foreach ($shortcut in $shortcuts) {
  if (Test-Path -LiteralPath $shortcut) {
    Remove-Item -LiteralPath $shortcut -Force
    Write-Host "Removed shortcut: $shortcut"
  }
}
```

The app is now removed. Tender records remain in `%AppData%\tender-desk\data`. If the NSIS error appeared while launching a newly downloaded installer rather than while uninstalling, download a fresh installer copy and verify its SHA-256 checksum with the publisher before running it.

To permanently erase this app's local records too, first make and verify a separate backup, then remove `%AppData%\tender-desk` explicitly. This permanently deletes the local database and tender and bill documents.





# force uniinstall the app
tasklist | findstr /i tender

taskkill /F /IM "Tender Desk.exe"

rmdir /S /Q "%LocalAppData%\Programs\tender-desk"


rmdir /S /Q "%LocalAppData%\tender-desk-updated"


rmdir /S /Q "%AppData%\tender-desk"


reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\c267e838-3a89-5796-a1a7-dab748ef8d35" /f


del "%AppData%\Microsoft\Windows\Start Menu\Programs\Tender Desk.lnk"


del "%UserProfile%\Desktop\Tender Desk.lnk"