const listEl = document.getElementById('list');
const inputEl = document.getElementById('newInput');
const formEl = document.getElementById('addForm');
const countEl = document.getElementById('count');
const clearDoneBtn = document.getElementById('clearDone');
const closeBtn = document.getElementById('closeBtn');
const filterBtns = document.querySelectorAll('.filters button');

let todos = [];
let filter = 'all';
const expandedIds = new Set(); // 詳細を開いているタスクのID（再描画しても開閉状態を保つ）
let draggingId = null; // 並べ替えでドラッグ中のタスクID（未ドラッグ時は null）

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// READ: 保存済みのTODOを読み込んで描画
async function load() {
  todos = (await window.api.load()) || [];
  render();
}

async function persist() {
  await window.api.save(todos);
}

// 詳細の入力中は毎キー保存せず、少し待ってからまとめて保存（書き込み負荷を抑える）
let saveTimer = null;
function persistDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist(), 400);
}

// textarea を内容の高さに合わせる（上限あり、それ以上はスクロール）
function autoSize(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
}

// ---- 並べ替え（ドラッグ＆ドロップ）----
// カーソルの Y 位置に対し、ドラッグ中の行を「この要素の直前」に差し込むべき要素を返す（null なら末尾）
function getDragAfterElement(y) {
  const els = [...listEl.querySelectorAll('.item:not(.dragging)')];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  for (const child of els) {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
  }
  return closest.element;
}

// 現在の DOM の並びを todos に反映して保存。
// フィルタで非表示のタスクは元の位置（配列インデックス）を保ち、表示中のタスクだけ新しい順序に並べ替える。
function commitOrderFromDom() {
  const orderedIds = [...listEl.querySelectorAll('.item')].map((el) => el.dataset.id);
  const visible = new Set(orderedIds);
  const byId = new Map(todos.map((t) => [t.id, t]));
  let i = 0;
  todos = todos.map((t) => (visible.has(t.id) ? byId.get(orderedIds[i++]) : t));
  persist();
}

function render(focusDetailId = null) {
  listEl.innerHTML = '';

  const visible = todos.filter((t) => {
    if (filter === 'active') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  if (visible.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent =
      filter === 'all' ? 'タスクはありません' : '該当するタスクはありません';
    listEl.appendChild(empty);
  }

  for (const todo of visible) {
    const li = document.createElement('li');
    li.className = 'item' + (todo.done ? ' done' : '');
    li.dataset.id = todo.id; // 並べ替え時に DOM から ID を読むため

    // 1行目：ハンドル / チェックボックス / 本文 / 詳細トグル / 削除
    const main = document.createElement('div');
    main.className = 'item-main';

    // ドラッグハンドル（ここをつかんだ時だけ並べ替えを開始する＝他の操作と干渉しない）
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.title = 'ドラッグして並べ替え';
    handle.draggable = true;
    handle.addEventListener('dragstart', (e) => {
      draggingId = todo.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', todo.id);
      e.dataTransfer.setDragImage(li, 12, 12); // つかんだ見た目を「行ごと」にする
      setTimeout(() => li.classList.add('dragging'), 0); // ドラッグ画像確定後に半透明化
    });
    handle.addEventListener('dragend', () => {
      // drop が走れば draggingId は null 化済み。残っていれば枠外ドロップ/キャンセル → 元の順序へ戻す
      if (draggingId == null) return;
      draggingId = null;
      render();
    });

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'check';
    cb.checked = todo.done;
    cb.addEventListener('change', () => toggle(todo.id));

    const span = document.createElement('span');
    span.className = 'text';
    span.textContent = todo.text;
    span.title = 'ダブルクリックで編集';
    span.addEventListener('dblclick', () => beginEdit(todo, span));

    const open = expandedIds.has(todo.id);
    const hasDetail = !!(todo.detail && todo.detail.trim());
    const detailBtn = document.createElement('button');
    detailBtn.className =
      'detail-btn' + (open ? ' open' : '') + (hasDetail ? ' has-detail' : '');
    detailBtn.textContent = open ? '▾' : '▸';
    detailBtn.title = hasDetail ? '詳細を表示/編集' : '詳細を追加';
    detailBtn.addEventListener('click', () => toggleDetail(todo.id));

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '🗑';
    del.title = '削除';
    del.addEventListener('click', () => remove(todo.id));

    main.append(handle, cb, span, detailBtn, del);
    li.appendChild(main);

    // 2行目（展開時のみ）：詳細の本文を編集する textarea
    let ta = null;
    if (open) {
      const detail = document.createElement('div');
      detail.className = 'item-detail';

      ta = document.createElement('textarea');
      ta.className = 'detail-input';
      ta.placeholder = '詳細を入力...';
      ta.maxLength = 2000;
      ta.value = todo.detail || '';
      ta.addEventListener('input', () => {
        todo.detail = ta.value;
        autoSize(ta);
        persistDebounced();
      });
      // フォーカスを外したら確実に保存（debounce待ちを取り消して即保存）
      ta.addEventListener('blur', () => {
        clearTimeout(saveTimer);
        persist();
      });

      detail.appendChild(ta);
      li.appendChild(detail);
    }

    listEl.appendChild(li);

    // DOMに入ってから高さ調整／開いた直後はカーソルを末尾に置いてフォーカス
    if (ta) {
      autoSize(ta);
      if (todo.id === focusDetailId) {
        ta.focus();
        const len = ta.value.length;
        ta.setSelectionRange(len, len);
      }
    }
  }

  const remaining = todos.filter((t) => !t.done).length;
  countEl.textContent = `残り ${remaining} / 全 ${todos.length} 件`;
}

// CREATE
function add(text) {
  const t = text.trim();
  if (!t) return;
  todos.unshift({
    id: uid(),
    text: t,
    detail: '',
    done: false,
    createdAt: Date.now(),
  });
  persist();
  render();
}

// UPDATE: 完了状態の切り替え
function toggle(id) {
  const t = todos.find((x) => x.id === id);
  if (t) t.done = !t.done;
  persist();
  render();
}

// UPDATE: 詳細エリアの開閉（開いたら入力欄にフォーカス）
function toggleDetail(id) {
  if (expandedIds.has(id)) {
    expandedIds.delete(id);
    render();
  } else {
    expandedIds.add(id);
    render(id);
  }
}

// UPDATE: 本文をインライン編集
function beginEdit(todo, span) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-input';
  input.value = todo.text;
  input.maxLength = 200;
  span.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const commit = () => {
    if (finished) return;
    finished = true;
    const v = input.value.trim();
    if (v) todo.text = v;
    persist();
    render();
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      finished = true;
      render();
    }
  });
}

// DELETE
function remove(id) {
  todos = todos.filter((x) => x.id !== id);
  expandedIds.delete(id);
  persist();
  render();
}

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  add(inputEl.value);
  inputEl.value = '';
  inputEl.focus();
});

clearDoneBtn.addEventListener('click', () => {
  todos = todos.filter((t) => !t.done);
  persist();
  render();
});

closeBtn.addEventListener('click', () => window.api.close());

filterBtns.forEach((b) => {
  b.addEventListener('click', () => {
    filter = b.dataset.filter;
    filterBtns.forEach((x) => x.classList.toggle('active', x === b));
    render();
  });
});

// 並べ替え：ドラッグ中はカーソル位置に行を実DOMで差し込み（ライブプレビュー）、ドロップで順序を確定
listEl.addEventListener('dragover', (e) => {
  if (draggingId == null) return;
  e.preventDefault(); // これがないと drop が発火しない
  e.dataTransfer.dropEffect = 'move';
  const dragging = listEl.querySelector('.item.dragging');
  if (!dragging) return;
  const after = getDragAfterElement(e.clientY);
  if (after == null) listEl.appendChild(dragging);
  else if (after !== dragging) listEl.insertBefore(dragging, after);
});

listEl.addEventListener('drop', (e) => {
  if (draggingId == null) return;
  e.preventDefault();
  commitOrderFromDom();
  draggingId = null;
  render();
});

load();
