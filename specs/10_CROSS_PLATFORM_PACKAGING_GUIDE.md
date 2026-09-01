# Cross-Platform Packaging & Desktop Wrapper Guide

## 1. Executive Summary & Strategy

To package the decoupled Spring Boot 3 backend and React 18 frontend into a native, standalone desktop application across **Windows**, **macOS**, and **Linux**, three desktop runtime packaging architectures are supported:

1. **Tauri (Rust wrapper):** Lightweight (~15MB installer size), high performance, native OS webview engine (WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux).
2. **Electron (Node.js + Chromium wrapper):** Enterprise standard, uniform rendering engine across all OS targets.
3. **jpackage + Embedded Web Server (Native Java bundle):** Pure Java packaging option producing native platform installers (`.msi`, `.dmg`, `.deb`/`.rpm`) bundling a lightweight JRE runtime alongside the Spring Boot executable.

---

## 2. Desktop Packaging Architecture Options

### Option 1: Tauri Packaging Strategy (Recommended)

```
+-------------------------------------------------------------------------------+
|                            TAURI APPLICATION BUNDLE                           |
|                                                                               |
|   +-----------------------------------------------------------------------+   |
|   |             Tauri Native Shell (Rust Runtime / OS WebView)            |   |
|   |                         (React Frontend Assets)                       |   |
|   +-----------------------------------------------------------------------+   |
|                                     |                                         |
|                 Sidecar Process Execution & Port Discovery                    |
|                                     v                                         |
|   +-----------------------------------------------------------------------+   |
|   |              Sidecar Binary: Headless Spring Boot JAR                 |   |
|   |                     (Native Image via GraalVM or JRE)                 |   |
|   +-----------------------------------------------------------------------+   |
+-------------------------------------------------------------------------------+
```

**Tauri Configuration (`tauri.conf.json` snippet):**
```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "tauri": {
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "net.filebot.desktop",
      "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
      "externalBin": [
        "binaries/spring-boot-backend"
      ]
    },
    "security": {
      "csp": "default-src 'self'; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*"
    }
  }
}
```

---

### Option 2: Electron Packaging Strategy

**Main Process Startup & Sidecar Lifecycle (`main.js`):**
```javascript
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let backendProcess;

function startBackend() {
  const javaBinary = 'java';
  const jarPath = path.join(app.getAppPath(), '..', 'backend', 'filebot-backend.jar');

  backendProcess = spawn(javaBinary, ['-jar', jarPath, '--server.port=0'], {
    stdio: 'pipe'
  });

  backendProcess.stdout.on('data', (data) => {
    const line = data.toString();
    const portMatch = line.match(/Tomcat started on port\(s\): (\d+)/);
    if (portMatch) {
      const port = portMatch[1];
      createWindow(`http://127.0.0.1:${port}`);
    }
  });
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'FileBot',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadURL(url);
}

app.whenReady().then(startBackend);

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  app.quit();
});
```

---

### Option 3: JDK `jpackage` Native Installer Bundling

The `jpackage` tool produces platform-native installers with a stripped-down Custom JRE created via `jlink`.

**Gradle `jpackage` Build Task Script:**
```groovy
tasks.register('createNativeAppImage', Exec) {
    dependsOn bootJar

    commandLine 'jpackage',
        '--type', 'app-image',
        '--name', 'FileBot',
        '--input', 'build/libs',
        '--main-jar', "${project.name}-${project.version}.jar",
        '--main-class', 'org.springframework.boot.loader.JarLauncher',
        '--dest', 'build/dist',
        '--java-options', '-Djava.awt.headless=true',
        '--icon', "src/main/resources/net/filebot/resources/window.icon64.png"
}
```

---

## 3. Platform-Specific Native Integration

1. **Windows:**
   - Bundled with installer (`.msi` / `.exe` via InnoSetup or WiX Toolset).
   - Windows drag-and-drop file paths normalized to standard backslash paths.
2. **macOS:**
   - Universal Binary (Apple Silicon `arm64` and Intel `x86_64`).
   - App bundle signed with Apple Developer ID certificate and notarized via `xcrun notarytool`.
   - Native macOS Menu Bar integration.
3. **Linux:**
   - Packaging formats: `.deb`, `.rpm`, `.AppImage`, and `Flatpak`.
   - Desktop entry file (`filebot.desktop`) registered for MIME type handling.

---

## 4. Summary Table of Deliverable Specifications

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
| `specs/10_CROSS_PLATFORM_PACKAGING_GUIDE.md` | Cross-Platform Packaging & Desktop Wrapper Guide |
