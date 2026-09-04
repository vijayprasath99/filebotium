const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let backendProcess;

function startBackend() {
  const javaBinary = 'java';
  const jarPath = path.join(app.getAppPath(), '..', 'build', 'libs', 'filebot-backend.jar');

  backendProcess = spawn(javaBinary, ['-jar', jarPath, '--server.port=8080'], {
    stdio: 'pipe'
  });

  backendProcess.stdout.on('data', (data) => {
    const line = data.toString();
    if (line.includes('Started App') || line.includes('Tomcat started')) {
      createWindow('http://127.0.0.1:8080');
    }
  });

  // Fallback timeout launch
  setTimeout(() => {
    if (!mainWindow) {
      createWindow('http://127.0.0.1:8080');
    }
  }, 3000);
}

function createWindow(url) {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'FileBot Desktop',
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
