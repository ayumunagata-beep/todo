# Floating TODO — プロジェクトガイド（Claude向け引き継ぎ）

常に最前面・画面左下に表示される、フローティング TODO ウィジェット。Electron 製。
CRUD（追加・一覧・更新・削除）に対応した最小構成の PoC。

---

## 1. 実行方法

```bash
npm install      # 依存（electron）取得。※この環境での注意は §6 参照
npm start        # = electron .  起動
```

- 終了：ウィジェット右上の **×**、または `Cmd + Q`
- データ保存先：`~/Library/Application Support/floating-todo/todos.json`
  （`app.getPath('userData')` 配下。`main.js` 先頭の `app.setName('floating-todo')` でパスを固定）
  - 保存は **一時ファイル→rename のアトミック書き込み**＋直前版を `todos.json.bak` に退避。読込時に本体が壊れていれば `.bak` から復旧するため、強制終了でもデータを失わない
  - userData 配下に置く理由：個人の TODO が Git リポジトリに混入しないようにするため

---

## 2. 技術スタック

- **Electron v42.4.1**（`node_modules/electron` に配置済み）
- 標準の 3 層構成：main process / preload / renderer
- 追加の UI ライブラリ・ビルドツールは無し（素の HTML/CSS/JS）
- 永続化は JSON ファイル（DB なし）

---

## 3. ファイル構成と役割

| ファイル | 役割 |
|---|---|
| `main.js` | メインプロセス。`BrowserWindow` 生成、**左下配置・常に最前面**の設定、IPC ハンドラ、`todos.json` の読み書き |
| `preload.js` | `contextBridge` で renderer に `window.api`（`load` / `save` / `close`）だけを安全に公開 |
| `index.html` | UI 構造（タイトルバー / 追加フォーム / フィルタ / リスト / フッタ） |
| `renderer.js` | 画面ロジック＋**CRUD 本体**。`window.api` 経由で永続化 |
| `styles.css` | スタイル。ダークなカード、ドラッグ領域、スクロールバー等 |
| `package.json` | `start` スクリプト（`electron .`） |
| `README.md` | エンドユーザー向けの簡易説明 |

データモデル（1 件の TODO）：

```js
{ id: string, text: string, detail: string, done: boolean, createdAt: number }
```

---

## 4. 要件と実装箇所（変更時の入口）

| 要件 / 挙動 | 実装場所 |
|---|---|
| **画面左下に配置** | `main.js` `createWindow()` の `screen.getPrimaryDisplay().workArea` から x,y 算出 |
| **常に最前面**（フルスクリーンの他アプリ上にも） | `main.js`：`alwaysOnTop:true` ＋ `win.setAlwaysOnTop(true,'floating')` ＋ `win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true})` |
| **フレームレス＋ドラッグ移動** | `main.js` `frame:false` ＋ `styles.css` の `.titlebar { -webkit-app-region: drag }`（`.close` は `no-drag`） |
| **ウィンドウのリサイズ** | `main.js`：`resizable:true`、`minWidth/minHeight`（`MIN_W/MIN_H`）。レイアウトは `100vh` の flex で追従 |
| **× で終了** | `renderer.js` closeBtn → `window.api.close()` → IPC `'app:close'` → `main.js` `app.quit()` |
| **Create**（追加） | `renderer.js` `add()`（フォーム submit / `＋`） |
| **Read**（一覧・フィルタ） | `renderer.js` `load()` → `render()`。フィルタ：すべて/未完了/完了 |
| **Update**（完了切替・本文編集） | `renderer.js` `toggle()`、`beginEdit()`（テキストを**ダブルクリック**で編集） |
| **詳細の表示・編集** | `renderer.js` `toggleDetail()`：各タスクの **▸/▾** で詳細エリアを開閉 → 展開した `textarea` に `detail` を入力。`input` で debounce 保存（`persistDebounced()`）＋ `blur` で確定保存。開閉状態は `expandedIds`（Set）で保持し再描画でも維持。詳細ありのタスクは ▸/▾ をアクセント色（`.detail-btn.has-detail`）で表示 |
| **Delete**（削除） | `renderer.js` `remove()`（🗑）、フッタ「完了を削除」 |
| **並べ替え**（ドラッグで順序変更） | `renderer.js`：各行左端の **⠿ ハンドル**だけを `draggable` 化（他操作と非干渉）。`listEl` の `dragover` で行を実DOM差し込み・`drop` で確定（`getDragAfterElement` / `commitOrderFromDom`）。フィルタ非表示のタスクは位置維持。順序は **`todos` の配列順**としてそのまま永続化（データモデル変更なし）。`styles.css` `.drag-handle` / `.item.dragging` |
| **永続化（消えない保存）** | renderer `persist()` → IPC `'todos:save'` → main `saveTodos()`（tmp書込→`.bak`退避→`rename` でアトミック置換）／起動時 `'todos:load'` → `loadTodos()`（本体破損時は `.bak` から復旧） |

IPC チャンネル一覧：`todos:load`（invoke）/ `todos:save`（invoke）/ `app:close`（send）。

---

## 5. よくある変更レシピ

- **初期サイズ・最小サイズ・画面端の余白**：`main.js` 冒頭の `WIN_W / WIN_H / MIN_W / MIN_H / MARGIN`
- **最前面の強さ**：`setAlwaysOnTop(true, 'floating')` の第 2 引数を `'screen-saver'` 等へ上げるとさらに前面
- **配置を別の隅へ**：`createWindow()` の x,y 計算を変更（例：右下なら `x = workArea.x + workArea.width - WIN_W - MARGIN`）
- **配色・見た目**：`styles.css` の `:root` 変数（`--bg/--fg/--accent` など）
- **保存項目を増やす**：データモデル（§3）＋ `renderer.js` の `add()`/`render()`／`main.js` は JSON をそのまま読み書きなので原則変更不要
- **並べ替えの無効化／ハンドル位置・見た目**：`renderer.js` の `drag-handle` 生成箇所と `listEl` の `dragover`/`drop`、`styles.css` の `.drag-handle`。順序は `todos` の配列順がそのまま保存されるので、別途ソート項目は不要

---

## 6. ⚠️ この環境（Claude のサンドボックス）での重要な注意

別 session の Claude が同じ環境で作業する際、以下を踏まないこと（実際に踏んで解決済み）：

1. **GUI アプリはサンドボックス内シェルから起動できない。**
   `electron .` で GUI を起動すると WindowServer 拒否により **SIGTRAP** で即死する。
   `electron --version` のような非 GUI 実行は通る。
   → **GUI の目視確認は不可。** 動作確認はユーザーに `npm start` を依頼する。Claude 側の検証は「`--version` 起動」「`node --check` による構文チェック」までに留める。

2. **`npm install` が EPERM で失敗**（`~/.npm/_cacache` への書き込み拒否）。
   → `npm install --cache "$TMPDIR/npm-cache"` を使う。

3. **Electron 本体（約115MB）の取得は Node の `fetch` が失敗**（`TypeError: fetch failed`）。一方 `curl` は同じ GitHub ホストに到達できる。
   → 本体は手動で配置済み。再取得が必要な場合の手順：
   ```bash
   # 1) 正しいバージョン/アーキで zip を取得（arm64 / darwin）
   VER=$(node -p "require('./node_modules/electron/package.json').version")
   ZIP="electron-v${VER}-darwin-arm64.zip"
   curl -L --fail -o "$TMPDIR/$ZIP" \
     "https://github.com/electron/electron/releases/download/v${VER}/${ZIP}"
   # 2) ditto で展開（unzip は .app の署名を壊し SIGTRAP の原因になるので不可）
   rm -rf node_modules/electron/dist && mkdir -p node_modules/electron/dist
   ditto -x -k "$TMPDIR/$ZIP" node_modules/electron/dist
   printf 'Electron.app/Contents/MacOS/Electron' > node_modules/electron/path.txt
   ```
   - 公式 arm64 バイナリは `adhoc, linker-signed, Sealed Resources=none`。`codesign --verify` は「code has no resources…」と警告するが**正常**で実行を妨げない。**ad-hoc 再署名はしない**（library-validation の整合が崩れて逆に SIGTRAP になる）。

4. 参考：この Mac は darwin arm64 / Node v26 / npm 11 / Swift 6.3。**Python の tkinter は不可**（Tcl/Tk 無し）。ダウンロード不要のネイティブ GUI が必要なら Swift+AppKit が選択肢。

---

## 7. 検証チェックリスト（Claude が実行可能な範囲）

- [ ] `node --check main.js preload.js renderer.js`（構文）
- [ ] `./node_modules/.bin/electron --version`（本体が解決・起動できるか）
- [ ] GUI の表示・操作確認は**ユーザー依頼**（`npm start`）
