const STORAGE_KEY = 'todos';

let pendingWrite = Promise.resolve();

export async function loadTodos() {
  const { [STORAGE_KEY]: todos = [] } = await chrome.storage.local.get(STORAGE_KEY);
  return todos;
}

export function onTodosChanged(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      callback(changes[STORAGE_KEY].newValue ?? []);
    }
  });
}

export function addTodo(text, source = null) {
  const todo = {
    id: crypto.randomUUID(),
    text,
    done: false,
    createdAt: Date.now(),
    completedAt: null,
    source,
  };
  return modifyTodos((todos) => [...todos, todo]);
}

export function setTodoDone(id, done) {
  return modifyTodo(id, { done, completedAt: done ? Date.now() : null });
}

export function renameTodo(id, text) {
  return modifyTodo(id, { text });
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

function modifyTodo(id, changes) {
  return modifyTodos((todos) => todos.map((todo) => (todo.id === id ? { ...todo, ...changes } : todo)));
}

function modifyTodos(transform) {
  const write = pendingWrite.then(async () => {
    const todos = await loadTodos();
    await chrome.storage.local.set({ [STORAGE_KEY]: transform(todos) });
  });
  pendingWrite = write.catch(() => {});
  return write;
}
