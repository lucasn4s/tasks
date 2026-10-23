import {
  addTodo,
  clearCompleted,
  loadTags,
  loadTodos,
  onTagsChanged,
  onTodosChanged,
  removeTodo,
  removeTodosCompletedBefore,
  renameTodo,
  reorderTodos,
  setTodoDone,
  toggleTodoTag,
} from './storage.js';
import { startPicker } from './picker-launcher.js';
import { renderTagBadge } from './tag-badge.js';
import { focusTagForm, renderTagsView, resetTagForm, setUpTagsView } from './tags-view.js';

const newTodoForm = document.querySelector('#new-todo-form');
const newTodoInput = document.querySelector('#new-todo-text');
const pickElementButton = document.querySelector('#pick-element');
const errorMessage = document.querySelector('#error-message');
const todoList = document.querySelector('#todo-list');
const todoItemTemplate = document.querySelector('#todo-item-template');
const emptyState = document.querySelector('#empty-state');
const clearCompletedButton = document.querySelector('#clear-completed');
const todayLabel = document.querySelector('#today');
const progressLabel = document.querySelector('#progress-label');
const progressBar = document.querySelector('#progress-bar');
const todosView = document.querySelector('#todos-view');
const tagsView = document.querySelector('#tags-view');
const openTagsButton = document.querySelector('#open-tags');
const closeTagsButton = document.querySelector('#close-tags');

let todos = [];
let tags = [];
let todoIdPickingTags = null;
let draggedItem = null;

init();

async function init() {
  todayLabel.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  newTodoForm.addEventListener('submit', onSubmitNewTodo);
  pickElementButton.addEventListener('click', onPickElement);
  clearCompletedButton.addEventListener('click', clearCompleted);
  openTagsButton.addEventListener('click', openTagsView);
  closeTagsButton.addEventListener('click', closeTagsView);
  todoList.addEventListener('dragover', onDragOver);
  todoList.addEventListener('drop', (event) => event.preventDefault());
  setUpTagsView();
  onTodosChanged((changedTodos) => {
    todos = changedTodos;
    render();
  });
  onTagsChanged((changedTags) => {
    tags = changedTags;
    render();
  });

  await removeTodosCompletedBefore(startOfToday());
  [todos, tags] = await Promise.all([loadTodos(), loadTags()]);
  render();
}

async function onSubmitNewTodo(event) {
  event.preventDefault();
  const text = newTodoInput.value.trim();
  if (!text) {
    return;
  }
  newTodoInput.value = '';
  await addTodo(text);
}

async function onPickElement() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await startPicker(activeTab.id);
    window.close();
  } catch {
    errorMessage.textContent = 'Não dá pra selecionar elementos nesta página (páginas internas do Chrome e a Web Store são bloqueadas).';
    errorMessage.hidden = false;
  }
}

function openTagsView() {
  todosView.hidden = true;
  tagsView.hidden = false;
  focusTagForm();
}

function closeTagsView() {
  resetTagForm();
  tagsView.hidden = true;
  todosView.hidden = false;
  newTodoInput.focus();
}

function render() {
  renderTodos();
  renderTagsView(tags, todos);
}

function renderTodos() {
  const pendingFirst = [...todos].sort((a, b) => Number(a.done) - Number(b.done));
  todoList.replaceChildren(...pendingFirst.map(renderTodoItem));
  renderProgress();
  emptyState.hidden = todos.length > 0;
  clearCompletedButton.hidden = !todos.some((todo) => todo.done);
}

function renderProgress() {
  const doneCount = todos.filter((todo) => todo.done).length;
  progressLabel.textContent = todos.length ? `${doneCount} de ${todos.length} feitas` : '';
  progressBar.style.width = todos.length ? `${(doneCount / todos.length) * 100}%` : '0';
}

function renderTodoItem(todo) {
  const item = todoItemTemplate.content.firstElementChild.cloneNode(true);
  item.dataset.id = todo.id;
  item.classList.toggle('done', todo.done);

  const handle = item.querySelector('.todo-handle');
  handle.addEventListener('dragstart', (event) => startDragging(event, item));
  handle.addEventListener('dragend', finishDragging);

  const checkbox = item.querySelector('.todo-check');
  checkbox.checked = todo.done;
  checkbox.addEventListener('change', () => setTodoDone(todo.id, checkbox.checked));

  const text = item.querySelector('.todo-text');
  text.textContent = todo.text;
  text.addEventListener('dblclick', () => startEditing(text, todo));

  renderTodoTags(item.querySelector('.todo-tags'), todo);
  const tagToggle = item.querySelector('.todo-tag-toggle');
  tagToggle.classList.toggle('active', todo.id === todoIdPickingTags);
  tagToggle.addEventListener('click', () => toggleTagPicker(todo.id));

  renderSource(item.querySelector('.todo-source'), todo.source);
  item.querySelector('.todo-delete').addEventListener('click', () => removeTodo(todo.id));
  return item;
}

function renderTodoTags(container, todo) {
  const tagIds = todo.tagIds ?? [];
  const badges = todo.id === todoIdPickingTags
    ? [...tags.map((tag) => createTagOption(todo.id, tag, tagIds.includes(tag.id))), createManageTagsLink()]
    : tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => renderTagBadge(document.createElement('span'), tag));
  container.replaceChildren(...badges);
  container.hidden = !badges.length;
}

function createTagOption(todoId, tag, isAssigned) {
  const option = renderTagBadge(document.createElement('button'), tag);
  option.type = 'button';
  option.classList.add('tag-option');
  option.setAttribute('aria-pressed', String(isAssigned));
  option.addEventListener('click', () => toggleTodoTag(todoId, tag.id));
  return option;
}

function createManageTagsLink() {
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'button-link';
  link.textContent = tags.length ? 'Gerenciar tags' : 'Nenhuma tag ainda · criar tags';
  link.addEventListener('click', openTagsView);
  return link;
}

function toggleTagPicker(todoId) {
  todoIdPickingTags = todoIdPickingTags === todoId ? null : todoId;
  renderTodos();
}

function renderSource(link, source) {
  if (!source?.url) {
    return;
  }
  link.href = source.url;
  link.title = source.title || source.url;
  link.textContent = `↗ ${source.title || new URL(source.url).hostname}`;
  link.hidden = false;
}

function startDragging(event, item) {
  draggedItem = item;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setDragImage(item, 12, item.offsetHeight / 2);
  requestAnimationFrame(() => item.classList.add('dragging'));
}

function onDragOver(event) {
  if (!draggedItem) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  const sameGroupItems = [...todoList.children].filter(
    (item) => item !== draggedItem && item.classList.contains('done') === draggedItem.classList.contains('done'),
  );
  const itemBelowCursor = sameGroupItems.find((item) => {
    const rect = item.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  });
  if (itemBelowCursor) {
    itemBelowCursor.before(draggedItem);
  } else {
    sameGroupItems.at(-1)?.after(draggedItem);
  }
}

async function finishDragging(event) {
  draggedItem.classList.remove('dragging');
  draggedItem = null;
  if (event.dataTransfer.dropEffect === 'none') {
    renderTodos();
    return;
  }
  await reorderTodos([...todoList.children].map((item) => item.dataset.id));
}

function startEditing(text, todo) {
  text.contentEditable = 'plaintext-only';
  text.focus();
  document.getSelection().selectAllChildren(text);
  const editing = new AbortController();

  text.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      text.textContent = todo.text;
      text.blur();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      text.blur();
    }
  }, { signal: editing.signal });
  text.addEventListener('blur', () => {
    editing.abort();
    finishEditing(text, todo);
  }, { once: true });
}

function finishEditing(text, todo) {
  text.removeAttribute('contenteditable');
  const newText = text.textContent.replace(/\s+/g, ' ').trim();
  if (!newText || newText === todo.text) {
    text.textContent = todo.text;
    return;
  }
  renameTodo(todo.id, newText);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}
