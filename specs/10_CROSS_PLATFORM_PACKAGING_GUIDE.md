# Cross-Platform Packaging & Desktop Wrapper Guide

## 1. Executive Summary & Strategy

To package the decoupled Spring Boot 3 backend and React 18 frontend into a native, standalone desktop application across **Windows**, **macOS**, and **Linux**, **Electron** is selected as the unified, cross-platform desktop wrapper:

```java
package net.filebot.backend.domain;

public enum PackagingTarget {
    ELECTRON
}

public enum OperatingSystem {
    WINDOWS, MACOS, LINUX
}
```

### Why Electron is the Unified Choice
1. **Single-Host Multi-Target Builds**: With `electron-builder`, Windows (`.exe`), macOS (`.dmg`, `.zip`), and Linux (`.AppImage`, `.deb`) installers can all be generated from a single development or CI environment without needing separate OS builds.
2. **Platform-Agnostic Backend (WORA)**: Spring Boot compiles once into `filebot-1.0-SNAPSHOT.jar` across all targets.
3. **Embedded JRE Bundling**: Pre-compiled, lightweight JRE distributions (Eclipse Temurin or Azul Zulu) can be placed into Electron's `extraResources` for each OS target, eliminating any runtime Java prerequisites for users.
4. **Direct Frontend Hosting**: Spring Boot bundles the React SPA directly into static resources under `static/ui/`, enabling identical local and network browser access while Electron loads `http://127.0.0.1:8080/ui`.

---

## 2. Desktop Packaging Architecture

```
+-------------------------------------------------------------------------------+
|                           ELECTRON APPLICATION BUNDLE                         |
|                                                                               |
|   +-----------------------------------------------------------------------+   |
|   |             Electron Main Process (Node.js Chromium Runtime)          |   |
|   |                  (Manages Window, Tray, & Backend Child Process)      |   |
|   +-----------------------------------------------------------------------+   |
|                                     |                                         |
|                   Spawns & Monitors via ChildProcess                          |
|                                     v                                         |
|   +-----------------------------------------------------------------------+   |
|   |       Bundled JRE + Spring Boot JAR (Serving React SPA & APIs)        |   |
|   |                     (http://127.0.0.1:8080)                           |   |
|   +-----------------------------------------------------------------------+   |
+-------------------------------------------------------------------------------+
```

---

## 3. Configuration & Startup Lifecycle

### 3.1 Electron Main Process (`desktop-wrapper/main.js`)

The main process manages backend process discovery, dev-mode backend liveness detection, port readiness detection, and clean shutdown:

```javascript
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow;
let backendProcess;

function resolveJavaBinary() {
  const bundledJava = process.platform === 'win32'
    ? path.join(process.resourcesPath, 'jre', 'bin', 'java.exe')
    : path.join(process.resourcesPath, 'jre', 'bin', 'java');

  return fs.existsSync(bundledJava) ? bundledJava : 'java';
}

function resolveJarPath() {
  const candidateDirs = [
    path.join(process.resourcesPath, 'backend'),
    path.join(app.getAppPath(), '..', 'build', 'libs'),
    path.join(__dirname, '..', 'build', 'libs')
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const jar = files.find(f => f.startsWith('filebot') && f.endsWith('.jar') && !f.endsWith('-sources.jar'));
      if (jar) return path.join(dir, jar);
    }
  }
  return path.join(app.getAppPath(), '..', 'build', 'libs', 'filebot-1.0-SNAPSHOT.jar');
}

function checkBackendRunning(callback) {
  const req = http.get('http://127.0.0.1:8080/api/v1/app/status', (res) => {
    callback(res.statusCode === 200);
  });
  req.on('error', () => callback(false));
  req.setTimeout(1000, () => {
    req.destroy();
    callback(false);
  });
}

function startBackend() {
  checkBackendRunning((isRunning) => {
    if (isRunning) {
      console.log('Backend is already running on port 8080. Connecting Electron directly...');
      createWindow('http://127.0.0.1:8080/ui');
      return;
    }

    const javaBinary = resolveJavaBinary();
    const jarPath = resolveJarPath();

    backendProcess = spawn(javaBinary, ['-jar', jarPath, '--server.port=8080'], {
      stdio: 'pipe'
    });

    backendProcess.stdout.on('data', (data) => {
      const line = data.toString();
      if (line.includes('Started FileBotBackendApplication') || line.includes('Tomcat started')) {
        createWindow('http://127.0.0.1:8080/ui');
      }
    });

    setTimeout(() => {
      if (!mainWindow) createWindow('http://127.0.0.1:8080/ui');
    }, 4000);
  });
}

function createWindow(url) {
  if (mainWindow) return;

  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'FileBot Desktop',
    webPreferences: {
      preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadURL(url);
}

app.whenReady().then(startBackend);

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});
```

### 3.2 Build & Packaging Configuration (`desktop-wrapper/package.json`)

```json
{
  "name": "filebot-desktop",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "pack": "electron-builder --dir",
    "dist": "electron-builder",
    "dist:all": "electron-builder -mwl",
    "dist:win": "electron-builder --win",
    "dist:mac": "electron-builder --mac",
    "dist:linux": "electron-builder --linux"
  },
  "build": {
    "appId": "net.filebot.desktop",
    "productName": "FileBot",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js"
    ],
    "extraResources": [
      {
        "from": "../build/libs",
        "to": "backend",
        "filter": ["*.jar"]
      }
    ],
    "win": {
      "target": ["nsis", "portable"]
    },
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.utilities"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Utility"
    }
  }
}
```

### 3.3 Native Path Resolution & Browser Sandbox Mitigation (`desktop-wrapper/preload.js`)

In web browsers (e.g. Chrome), security sandbox policies strip absolute filesystem paths (`C:\...`) on drag-and-drop or file pickers, supplying only `file.name`. Because FileBot requires real paths to inspect and rename files on disk, Electron provides native filesystem access.

In modern Electron (v30+), direct `File.path` access on DOM events has been deprecated and removed. Native paths must be retrieved using `webUtils.getPathForFile(file)` via the preload bridge:

```javascript
// desktop-wrapper/preload.js
const { contextBridge, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPath: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (e) {
      return (file && file.path) ? file.path : '';
    }
  }
});
```

On the frontend, all file drop and input handlers consume paths using the unified `getFilePath` / `getFilePaths` utility (`frontend/src/utils/fileUtils.ts`):

```typescript
export function getFilePath(file: File): string {
  if (typeof window !== 'undefined' && window.electronAPI?.getPath) {
    try {
      const p = window.electronAPI.getPath(file);
      if (p) return p;
    } catch {
      // Fall through
    }
  }
  return (file as any).path || file.name;
}
```

### 3.4 Local Testing Workflows

1. **Live Dev Mode (Hot reload / rapid backend iterations):**
   - Keep `./gradlew bootRun` running in Terminal 1.
   - Run `cd desktop-wrapper && npm start` in Terminal 2.
   - Electron detects that the backend is already responding on port 8080 and skips spawning a child process, connecting directly.

2. **Standalone Desktop Mode (Full packaged bundle test):**
   - Build backend JAR: `./gradlew build`.
   - Run `cd desktop-wrapper && npm start`.
   - Electron automatically launches `build/libs/filebot-1.0-SNAPSHOT.jar` and manages its lifecycle.

---

## 4. Platform-Specific Native Integration

1. **Windows (`OperatingSystem.WINDOWS`):**
   - Packaged into an NSIS installer (`.exe`) and portable standalone binary.
   - Native Windows notification toasts and file drag-and-drop normalization.
2. **macOS (`OperatingSystem.MACOS`):**
   - Packaged as `.dmg` and `.zip` bundles (Universal or x86_64 / Apple Silicon arm64).
   - Standard macOS Application menu and Dock tile support.
3. **Linux (`OperatingSystem.LINUX`):**
   - Packaged as `.AppImage` (runs on all major distros) and Debian `.deb`.
   - Desktop entry file with MIME type associations for video, audio, and subtitle formats.

---

## 5. Summary Table of Deliverable Specifications

| Document Path | Specification Area |
| :--- | :--- |
| `specs/00_SYSTEM_ARCHITECTURE_AND_MODELS.md` | System Architecture, Domain Models, Event Loop & DTOs |
| `specs/01_APP_SHELL_NAVIGATION_AND_GLOBAL_DND.md` | App Shell, Navigation & Global Drag-and-Drop |
| `specs/02_RENAME_WORKSPACE_AND_MATCHING_ENGINE.md` | Rename Workspace & Matching Engine |
| `specs/03_GROOVY_FORMAT_EXPRESSION_ENGINE.md` | Groovy Format Expression Engine |
| `specs/04_EPISODES_EXPLORER_AND_FETCHER.md` | Episodes Explorer & Fetcher |
| `specs/05_SUBTITLES_SEARCH_AND_DOWNLOADER.md` | Subtitles Search & Downloader |
| `specs/06_SFV_VERIFICATION_AND_HASHING.md` | SFV Verification & Checksum Hashing |
| `specs/07_ANALYZE_PANEL_AND_MEDIAINFO_INSPECTOR.md` | Analyze Panel & MediaInfo Inspector |
| `specs/08_HISTORY_AND_TRANSACTION_ROLLBACK.md` | History & Transaction Rollback |
| `specs/09_SETTINGS_AND_PREFERENCES.md` | Settings & Preferences |
| `specs/10_CROSS_PLATFORM_PACKAGING_GUIDE.md` | Cross-Platform Packaging & Desktop Wrapper Guide (Electron) |
