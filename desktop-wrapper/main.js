const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const http = require('http');

let mainWindow;
let backendProcess;

function resolveJavaBinary() {
  // If bundled with a private JRE in production resources
  const bundledJava = process.platform === 'win32'
    ? path.join(process.resourcesPath, 'jre', 'bin', 'java.exe')
    : path.join(process.resourcesPath, 'jre', 'bin', 'java');

  if (fs.existsSync(bundledJava)) {
    return bundledJava;
  }
  return 'java';
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
      const jar = files.find(f => f.startsWith('filebot') && f.endsWith('.jar') && !f.endsWith('-sources.jar') && !f.endsWith('-javadoc.jar'));
      if (jar) {
        return path.join(dir, jar);
      }
    }
  }

  // Fallback default
  return path.join(app.getAppPath(), '..', 'build', 'libs', 'filebot-1.0-SNAPSHOT.jar');
}

function checkBackendRunning(callback) {
  const req = http.get('http://127.0.0.1:8080/api/v1/app/status', (res) => {
    if (res.statusCode === 200) {
      callback(true);
    } else {
      callback(false);
    }
  });
  req.on('error', () => {
    callback(false);
  });
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

    console.log(`Starting backend with ${javaBinary} -jar ${jarPath}`);

    backendProcess = spawn(javaBinary, ['-jar', jarPath, '--server.port=8080'], {
      stdio: 'pipe'
    });

    backendProcess.stdout.on('data', (data) => {
      const line = data.toString();
      console.log(`[Backend]: ${line}`);
      if (line.includes('Started FileBotBackendApplication') || line.includes('Tomcat started') || line.includes('Started App')) {
        createWindow('http://127.0.0.1:8080/ui');
      }
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error]: ${data.toString()}`);
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend process:', err);
    });

    // Fallback timeout launch
    setTimeout(() => {
      if (!mainWindow) {
        createWindow('http://127.0.0.1:8080/ui');
      }
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(startBackend);

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
