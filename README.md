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
- Tender records include project/work references, work code, quoted rate and rebate, project dates and extensions, bank guarantee validity and extensions, FDR, and insurance details. The application-generated tender ID remains separate and is used for local file folders.
- Tender list search also matches the official tender ID, department, location and work-order number. Existing databases are updated additively when the app starts; existing tenders are retained and marked "Not set" for the new status.
- When uploading tender or bill documents, enter a short label of 1–10 letters, numbers, spaces, hyphens or underscores. The label is stored with the original filename; uploaded files remain in their existing local folders.
- Outstanding amount is calculated as `max(0, tender bidding amount - total amount received)`.
- Running bills include editable percentage rates and deductions, a bill-type selector, payment reference fields, and a live gross/deduction/net-payable calculation. The displayed starter rates are editable and should be checked against the applicable contract. Existing local databases receive additive schema migrations when the app starts; existing tender and bill records are retained.
- Bill rows provide a file popup with each document's short name and upload date/time, plus local view and save-copy actions. Each tender details page can print a project billing-status statement with bill totals and signature lines; it is an internal record, not a tax invoice.
- Tender names are unique without regard to letter case.
- Local document open uses the operating system's default application. Missing or moved files are reported in the app.
