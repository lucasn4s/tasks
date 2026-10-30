const TODOS_KEY = 'todos';
const TAGS_KEY = 'tags';
const TAG_FILTER_KEY = 'tagFilter';

let pendingWrite = Promise.resolve();

export function loadTodos() {
  return loadList(TODOS_KEY);
}

export function loadTags() {
  return loadList(TAGS_KEY);
}

export function loadTagFilter() {
  return loadList(TAG_FILTER_KEY);
}

export function saveTagFilter(tagIds) {
  return chrome.storage.local.set({ [TAG_FILTER_KEY]: tagIds });
}

export function onTodosChanged(callback) {
  onListChanged(TODOS_KEY, callback);
}

export function onTagsChanged(callback) {
  onListChanged(TAGS_KEY, callback);
}

export function addTodo(text, source = null, tagIds = []) {
  const todo = {
    id: crypto.randomUUID(),
    text,
    done: false,
    createdAt: Date.now(),
    completedAt: null,
    source,
    tagIds,
  };
  return modifyTodos((todos) => [...todos, todo]);
}

export function setTodoDone(id, done) {
  return modifyTodo(id, { done, completedAt: done ? Date.now() : null });
}

export function renameTodo(id, text) {
  return modifyTodo(id, { text });
}

export function toggleTodoTag(id, tagId) {
  return modifyTodos((todos) => todos.map((todo) => (
    todo.id === id ? { ...todo, tagIds: toggleItem(todo.tagIds ?? [], tagId) } : todo
  )));
}

export function removeTodo(id) {
  return modifyTodos((todos) => todos.filter((todo) => todo.id !== id));
}

export function clearCompleted() {
  return modifyTodos((todos) => todos.filter((todo) => !todo.done));
}

export function removeTodosCompletedBefore(timestamp) {
  return modifyTodos((todos) => todos.filter((todo) => !todo.done || todo.completedAt >= timestamp));
}

export function reorderTodos(orderedIds) {
  const positionById = new Map(orderedIds.map((id, index) => [id, index]));
  const positionOf = (todo) => positionById.get(todo.id) ?? orderedIds.length;
  return modifyTodos((todos) => [...todos].sort((a, b) => positionOf(a) - positionOf(b)));
}

export function createTag(name, color) {
  const tag = { id: crypto.randomUUID(), name, color };
  return modifyLists(({ tags }) => ({ tags: [...tags, tag] }));
}

export function updateTag(id, changes) {
  return modifyLists(({ tags }) => ({ tags: tags.map((tag) => (tag.id === id ? { ...tag, ...changes } : tag)) }));
}

export function removeTag(id) {
  return modifyLists(({ todos, tags }) => ({
    tags: tags.filter((tag) => tag.id !== id),
    todos: todos.map((todo) => ({ ...todo, tagIds: (todo.tagIds ?? []).filter((tagId) => tagId !== id) })),
  }));
}

async function loadList(key) {
  const { [key]: list = [] } = await chrome.storage.local.get(key);
  return list;
}

function onListChanged(key, callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[key]) {
      callback(changes[key].newValue ?? []);
    }
  });
}

function modifyTodo(id, changes) {
  return modifyTodos((todos) => todos.map((todo) => (todo.id === id ? { ...todo, ...changes } : todo)));
}

function toggleItem(list, item) {
  return list.includes(item) ? list.filter((other) => other !== item) : [...list, item];
}

function modifyTodos(transform) {
  return modifyLists(({ todos }) => ({ todos: transform(todos) }));
}

function modifyLists(transform) {
  const write = pendingWrite.then(async () => {
    const { [TODOS_KEY]: todos = [], [TAGS_KEY]: tags = [] } = await chrome.storage.local.get([TODOS_KEY, TAGS_KEY]);
    await chrome.storage.local.set(transform({ todos, tags }));
  });
  pendingWrite = write.catch(() => {});
  return write;
}
