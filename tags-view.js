import { createTag, removeTag, updateTag } from './storage.js';
import { renderTagBadge } from './tag-badge.js';

const TAG_COLORS = [
  { value: '#2563eb', label: 'Azul' },
  { value: '#16a34a', label: 'Verde' },
  { value: '#d97706', label: 'Laranja' },
  { value: '#dc2626', label: 'Vermelho' },
  { value: '#9333ea', label: 'Roxo' },
  { value: '#db2777', label: 'Rosa' },
  { value: '#0891b2', label: 'Ciano' },
  { value: '#64748b', label: 'Cinza' },
];

const tagForm = document.querySelector('#tag-form');
const tagNameInput = document.querySelector('#tag-name');
const tagColorPicker = document.querySelector('#tag-colors');
const tagSubmitButton = document.querySelector('#tag-submit');
const cancelTagEditButton = document.querySelector('#cancel-tag-edit');
const tagError = document.querySelector('#tag-error');
const tagList = document.querySelector('#tag-list');
const tagItemTemplate = document.querySelector('#tag-item-template');
const tagsEmptyState = document.querySelector('#tags-empty');

let tags = [];
let todos = [];
let editingTagId = null;

export function setUpTagsView() {
  tagColorPicker.replaceChildren(...TAG_COLORS.map(createColorOption));
  tagForm.addEventListener('submit', onSubmitTag);
  tagNameInput.addEventListener('input', () => { tagError.hidden = true; });
  cancelTagEditButton.addEventListener('click', resetTagForm);
  resetTagForm();
}

export function renderTagsView(currentTags, currentTodos) {
  tags = currentTags;
  todos = currentTodos;
  if (editingTagId && !tags.some((tag) => tag.id === editingTagId)) {
    resetTagForm();
  }
  renderTagList();
}

export function focusTagForm() {
  tagNameInput.focus();
}

export function resetTagForm() {
  editingTagId = null;
  tagForm.reset();
  selectColor(colorAfter(tags.at(-1)?.color));
  tagSubmitButton.textContent = 'Criar';
  cancelTagEditButton.hidden = true;
  tagError.hidden = true;
  renderTagList();
}

function createColorOption({ value, label }) {
  const option = document.createElement('input');
  option.type = 'radio';
  option.name = 'tag-color';
  option.value = value;
  option.className = 'color-option';
  option.title = label;
  option.setAttribute('aria-label', label);
  option.style.setProperty('--tag-color', value);
  return option;
}

async function onSubmitTag(event) {
  event.preventDefault();
  const name = tagNameInput.value.replace(/\s+/g, ' ').trim();
  if (!name) {
    return;
  }
  if (isNameTaken(name)) {
    tagError.textContent = `Já existe uma tag "${name}".`;
    tagError.hidden = false;
    return;
  }
  const color = selectedColor();
  if (editingTagId) {
    await updateTag(editingTagId, { name, color });
    resetTagForm();
    return;
  }
  await createTag(name, color);
  tagNameInput.value = '';
  selectColor(colorAfter(color));
}

function isNameTaken(name) {
  const normalizedName = name.toLocaleLowerCase('pt-BR');
  return tags.some((tag) => tag.id !== editingTagId && tag.name.toLocaleLowerCase('pt-BR') === normalizedName);
}

function startEditingTag(tag) {
  editingTagId = tag.id;
  tagNameInput.value = tag.name;
  selectColor(tag.color);
  tagSubmitButton.textContent = 'Salvar';
  cancelTagEditButton.hidden = false;
  tagError.hidden = true;
  tagNameInput.focus();
  renderTagList();
}

function renderTagList() {
  tagList.replaceChildren(...tags.map(renderTagItem));
  tagsEmptyState.hidden = tags.length > 0;
}

function renderTagItem(tag) {
  const item = tagItemTemplate.content.firstElementChild.cloneNode(true);
  item.classList.toggle('editing', tag.id === editingTagId);
  renderTagBadge(item.querySelector('.tag-badge'), tag);

  const usageCount = todos.filter((todo) => todo.tagIds?.includes(tag.id)).length;
  item.querySelector('.tag-usage').textContent = describeUsage(usageCount);
  item.querySelector('.tag-edit').addEventListener('click', () => startEditingTag(tag));

  const deleteButton = item.querySelector('.tag-delete');
  deleteButton.addEventListener('click', () => {
    if (usageCount && !deleteButton.classList.contains('confirming')) {
      askDeleteConfirmation(deleteButton, usageCount);
      return;
    }
    removeTag(tag.id);
  });
  return item;
}

function askDeleteConfirmation(deleteButton, usageCount) {
  const originalText = deleteButton.textContent;
  deleteButton.classList.add('confirming');
  deleteButton.textContent = 'Confirmar exclusão';
  deleteButton.title = `A tag será removida de ${describeUsage(usageCount)}`;
  deleteButton.addEventListener('blur', () => {
    deleteButton.classList.remove('confirming');
    deleteButton.textContent = originalText;
    deleteButton.removeAttribute('title');
  }, { once: true });
}

function describeUsage(count) {
  return count === 1 ? '1 tarefa' : `${count} tarefas`;
}

function selectedColor() {
  return tagForm.elements['tag-color'].value;
}

function selectColor(color) {
  tagForm.elements['tag-color'].value = color;
}

function colorAfter(color) {
  const index = TAG_COLORS.findIndex((option) => option.value === color);
  return TAG_COLORS[(index + 1) % TAG_COLORS.length].value;
}
