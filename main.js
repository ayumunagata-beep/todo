const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const WIN_W = 320; // 初期幅
const WIN_H = 460; // 初期高さ
const MIN_W = 240; // 最小幅（リサイズ下限）
const MIN_H = 260; // 最小高さ（リサイズ下限）
const MARGIN = 16; // 画面端からの余白

let win;

function dataFile() {
  return path.join(app.getPath('userData'), 'todos.json');
}

function loadTodos() {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf-8'));
  } catch {
    return [];
  }
}

function saveTodos(todos) {
  try {
    fs.writeFileSync(dataFile(), JSON.stringify(todos, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function createWindow() {
  // プライマリディスプレイの作業領域（Dock/メニューバーを除いた領域）の左下に配置
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + MARGIN;
  const y = workArea.y + workArea.height - WIN_H - MARGIN;

  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    minWidth: MIN_W,
    minHeight: MIN_H,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 通常ウィンドウより前面に固定。フルスクリーンの別アプリの上にも出す。
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  ipcMain.handle('todos:load', () => loadTodos());
  ipcMain.handle('todos:save', (_e, todos) => saveTodos(todos));
  ipcMain.on('app:close', () => app.quit());

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
