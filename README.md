# Floating TODO

常に最前面に表示される、画面左下のTODOウィジェット（Electron製）。

## 特徴

- 画面**左下**に固定、**常に最前面**（フルスクリーンの別アプリの上にも表示）
- フレームレスの小型カード。**ヘッダーをドラッグ**して移動可能
- **× ボタンで終了**（押すまで出っぱなし）
- CRUD: 追加 / 一覧 / 完了トグル・**ダブルクリックで本文編集** / 削除
- データは JSON に永続化（再起動しても残る）

## 使い方

```bash
npm install   # 初回のみ（electron を取得）
npm start     # 起動
```

終了はウィジェット右上の **×**、または `Cmd + Q`。

## データの保存場所

`~/Library/Application Support/floating-todo/todos.json`
