const listEl = document.getElementById('list');
const inputEl = document.getElementById('newInput');
const formEl = document.getElementById('addForm');
const countEl = document.getElementById('count');
const clearDoneBtn = document.getElementById('clearDone');
const closeBtn = document.getElementById('closeBtn');
const filterBtns = document.querySelectorAll('.filters button');

let todos = [];
let filter = 'all';

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

function render() {
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

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '🗑';
    del.title = '削除';
    del.addEventListener('click', () => remove(todo.id));

    li.append(cb, span, del);
    listEl.appendChild(li);
  }

  const remaining = todos.filter((t) => !t.done).length;
  countEl.textContent = `残り ${remaining} / 全 ${todos.length} 件`;
}

// CREATE
function add(text) {
  const t = text.trim();
  if (!t) return;
  todos.unshift({ id: uid(), text: t, done: false, createdAt: Date.now() });
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

load();
