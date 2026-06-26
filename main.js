const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// userData の保存先がブレないようアプリ名を固定（todos.json の場所を常に一定に保つ）
app.setName('floating-todo');

const WIN_W = 320; // 初期幅
const WIN_H = 460; // 初期高さ
const MIN_W = 240; // 最小幅（リサイズ下限）
const MIN_H = 260; // 最小高さ（リサイズ下限）
const MARGIN = 16; // 画面端からの余白

let win;

// 保存先（ローカルの JSON ファイル）。userData 配下なので個人のTODOがGitに混入しない。
function dataFile() {
  return path.join(app.getPath('userData'), 'todos.json');
}
function backupFile() {
  return dataFile() + '.bak';
}

// 読み込み：本体が壊れていればバックアップから復旧（破損・中断時もデータを失わない）
function loadTodos() {
  for (const f of [dataFile(), backupFile()]) {
    try {
      const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
      if (Array.isArray(data)) return data;
    } catch {
      // 次の候補（.bak）へフォールバック
    }
  }
  return [];
}

// 保存：一時ファイルに書いてから rename（原子的置換）。書き込み中に強制終了されても壊れない。
function saveTodos(todos) {
  try {
    const file = dataFile();
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(todos, null, 2), 'utf-8');
    if (fs.existsSync(file)) fs.copyFileSync(file, backupFile()); // 直前の正常版を退避
    fs.renameSync(tmp, file); // 同一ボリューム内の rename はアトミック
    return true;
  } catch (e) {
    console.error('saveTodos failed:', e);
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
