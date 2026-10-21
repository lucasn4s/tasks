import { addTodo, loadTodos, onTodosChanged } from './storage.js';
import { startPicker } from './picker-launcher.js';

const MENU_ADD_SELECTION = 'add-selection';
const MENU_PICK_ELEMENT = 'pick-element';
const BADGE_COLOR = '#2563eb';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ADD_SELECTION,
    title: 'Adicionar "%s" aos afazeres',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: MENU_PICK_ELEMENT,
    title: 'Selecionar elemento para virar tarefa',
    contexts: ['page', 'link', 'image'],
  });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  loadTodos().then(updateBadge);
});

chrome.runtime.onStartup.addListener(() => {
  loadTodos().then(updateBadge);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ADD_SELECTION) {
    addTodo(info.selectionText.trim(), { url: info.pageUrl, title: tab?.title ?? info.pageUrl });
  }
  if (info.menuItemId === MENU_PICK_ELEMENT) {
    startPicker(tab.id);
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'pick-element') {
    startPicker(tab.id);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'add-todo') {
    return false;
  }
  addTodo(message.text, message.source).then(() => sendResponse({ ok: true }));
  return true;
});

onTodosChanged(updateBadge);

function updateBadge(todos) {
  const pendingCount = todos.filter((todo) => !todo.done).length;
  chrome.action.setBadgeText({ text: pendingCount ? String(pendingCount) : '' });
}
