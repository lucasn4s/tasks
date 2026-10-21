(() => {
  if (window.afazeresPickerRunning) {
    return;
  }
  window.afazeresPickerRunning = true;

  const MAX_TEXT_LENGTH = 300;
  const TOAST_DURATION_MS = 2500;
  const SWALLOWED_EVENTS = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'auxclick', 'contextmenu'];
  const ISOLATED_KEY_EVENTS = ['keydown', 'keyup', 'keypress'];
  const PICKER_MARKUP = `
    <style>
      :host { all: initial; }
      .highlight {
        position: fixed;
        display: none;
        box-sizing: border-box;
        background: rgba(37, 99, 235, 0.14);
        outline: 2px solid #2563eb;
        border-radius: 3px;
        transition: top 60ms, left 60ms, width 60ms, height 60ms;
      }
      .tag {
        position: absolute;
        bottom: 100%;
        left: -2px;
        margin-bottom: 4px;
        padding: 3px 6px;
        border-radius: 3px;
        background: #2563eb;
        color: #fff;
        font: 11px/1.2 ui-monospace, monospace;
        white-space: nowrap;
      }
      .highlight.near-top .tag { bottom: auto; top: 2px; left: 2px; margin: 0; }
      .banner {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        max-width: min(560px, calc(100vw - 32px));
        padding: 9px 16px;
        border-radius: 999px;
        background: #111827;
        color: #f9fafb;
        font: 13px/1.4 system-ui, sans-serif;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hint { bottom: 20px; }
      .toast { bottom: 64px; display: none; background: #065f46; }
      .toast.error { background: #991b1b; }
      kbd {
        padding: 1px 5px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.15);
        font: inherit;
      }
      .editor {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: none;
        flex-direction: column;
        gap: 10px;
        box-sizing: border-box;
        width: min(520px, calc(100vw - 32px));
        padding: 14px;
        border-radius: 12px;
        background: #111827;
        color: #f9fafb;
        font: 13px/1.4 system-ui, sans-serif;
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.35);
        pointer-events: auto;
      }
      .editor label { font-weight: 600; }
      .editor textarea {
        box-sizing: border-box;
        width: 100%;
        min-height: 64px;
        padding: 8px 10px;
        border: 1px solid #374151;
        border-radius: 8px;
        background: #1f2937;
        color: #f9fafb;
        font: 14px/1.4 system-ui, sans-serif;
        resize: vertical;
      }
      .editor textarea:focus { outline: 2px solid #3b82f6; outline-offset: -1px; }
      .editor-actions { display: flex; align-items: center; gap: 8px; }
      .editor-actions .spacer { flex: 1; }
      .editor-shortcuts { color: #9ca3af; font-size: 12px; }
      .editor button {
        padding: 7px 12px;
        border: 0;
        border-radius: 8px;
        font: inherit;
        cursor: pointer;
      }
      .editor .primary { background: #2563eb; color: #fff; font-weight: 600; }
      .editor .primary:hover { background: #1d4ed8; }
      .editor .primary:disabled { opacity: 0.5; cursor: not-allowed; }
      .editor .secondary { background: transparent; color: #d1d5db; }
      .editor .secondary:hover { background: #1f2937; color: #fff; }
    </style>
    <div class="highlight"><span class="tag"></span></div>
    <div class="banner hint">
      Clique no elemento para criar a tarefa · <kbd>↑</kbd><kbd>↓</kbd> ajusta a seleção · <kbd>Esc</kbd> cancela
    </div>
    <div class="banner toast"></div>
    <form class="editor">
      <label for="todo-text">Ajuste o texto da tarefa</label>
      <textarea id="todo-text" rows="3"></textarea>
      <div class="editor-actions">
        <button type="button" class="secondary" data-action="repick">← Escolher outro elemento</button>
        <span class="spacer"></span>
        <button type="button" class="secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="primary">Criar tarefa</button>
      </div>
      <span class="editor-shortcuts"><kbd>Enter</kbd> cria · <kbd>Esc</kbd> cancela</span>
    </form>
  `;

  const host = document.createElement('div');
  host.style.cssText = 'position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = PICKER_MARKUP;
  const highlight = shadow.querySelector('.highlight');
  const tag = shadow.querySelector('.tag');
  const hint = shadow.querySelector('.hint');
  const toast = shadow.querySelector('.toast');
  const editor = shadow.querySelector('.editor');
  const editorTextarea = editor.querySelector('textarea');
  const editorSubmitButton = editor.querySelector('[type="submit"]');
  document.documentElement.append(host);

  let selectedElement = null;
  let toastTimer = null;
  const descendantsTrail = [];

  setUpEditor();
  ISOLATED_KEY_EVENTS.forEach((type) => host.addEventListener(type, (event) => event.stopPropagation()));
  window.addEventListener('scroll', positionHighlight, true);
  window.addEventListener('resize', positionHighlight);
  startPicking();

  function startPicking() {
    hint.style.display = 'block';
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onPickingKeyDown, true);
    SWALLOWED_EVENTS.forEach((type) => document.addEventListener(type, swallowEvent, true));
  }

  function stopPicking() {
    hint.style.display = 'none';
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onPickingKeyDown, true);
    SWALLOWED_EVENTS.forEach((type) => document.removeEventListener(type, swallowEvent, true));
  }

  function onMouseMove(event) {
    if (event.target === selectedElement || descendantsTrail.includes(event.target)) {
      return;
    }
    descendantsTrail.length = 0;
    select(event.target);
  }

  function onPickingKeyDown(event) {
    const keyHandlers = { Escape: teardown, ArrowUp: selectParent, ArrowDown: selectLastDescendant };
    const handler = keyHandlers[event.key];
    if (!handler) {
      return;
    }
    swallowEvent(event);
    handler();
  }

  function onClick(event) {
    swallowEvent(event);
    const text = extractText(selectedElement ?? event.target);
    if (!text) {
      showToast('Esse elemento não tem texto. Tente outro.', { isError: true });
      return;
    }
    stopPicking();
    openEditor(text);
  }

  function setUpEditor() {
    editor.addEventListener('submit', onSubmitEditor);
    editorTextarea.addEventListener('input', updateSubmitButton);
    editorTextarea.addEventListener('keydown', onEditorKeyDown);
    editor.querySelector('[data-action="cancel"]').addEventListener('click', teardown);
    editor.querySelector('[data-action="repick"]').addEventListener('click', backToPicking);
  }

  function openEditor(text) {
    editorTextarea.value = text;
    updateSubmitButton();
    editor.style.display = 'flex';
    editorTextarea.focus();
    editorTextarea.setSelectionRange(text.length, text.length);
  }

  function closeEditor() {
    editor.style.display = 'none';
  }

  function backToPicking() {
    closeEditor();
    startPicking();
  }

  function onEditorKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      teardown();
    }
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      editor.requestSubmit();
    }
  }

  function updateSubmitButton() {
    editorSubmitButton.disabled = !normalizeWhitespace(editorTextarea.value);
  }

  async function onSubmitEditor(event) {
    event.preventDefault();
    const text = normalizeWhitespace(editorTextarea.value);
    if (!text) {
      return;
    }
    closeEditor();
    highlight.style.display = 'none';
    await saveTodo(text);
    setTimeout(teardown, TOAST_DURATION_MS);
  }

  async function saveTodo(text) {
    try {
      await chrome.runtime.sendMessage({
        type: 'add-todo',
        text,
        source: { url: location.href, title: document.title },
      });
      showToast(`✓ Tarefa adicionada: ${text}`);
    } catch {
      showToast('Não consegui salvar a tarefa. Recarregue a página e tente de novo.', { isError: true });
    }
  }

  function select(element) {
    selectedElement = element;
    positionHighlight();
  }

  function selectParent() {
    const parent = selectedElement?.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) {
      return;
    }
    descendantsTrail.push(selectedElement);
    select(parent);
  }

  function selectLastDescendant() {
    if (descendantsTrail.length) {
      select(descendantsTrail.pop());
    }
  }

  function positionHighlight() {
    if (!selectedElement) {
      return;
    }
    const rect = selectedElement.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: 'block',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    highlight.classList.toggle('near-top', rect.top < 24);
    tag.textContent = describeElement(selectedElement);
  }

  function describeElement(element) {
    const id = element.id ? `#${element.id}` : '';
    const firstClass = element.classList[0] ? `.${element.classList[0]}` : '';
    return `${element.tagName.toLowerCase()}${id}${firstClass}`;
  }

  function extractText(element) {
    const rawText = element.innerText
      || element.value
      || element.getAttribute('aria-label')
      || element.getAttribute('title')
      || element.getAttribute('alt')
      || '';
    const text = normalizeWhitespace(rawText);
    return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}…` : text;
  }

  function normalizeWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function showToast(message, { isError = false } = {}) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.style.display = 'block';
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, TOAST_DURATION_MS);
  }

  function swallowEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function teardown() {
    stopPicking();
    clearTimeout(toastTimer);
    window.removeEventListener('scroll', positionHighlight, true);
    window.removeEventListener('resize', positionHighlight);
    host.remove();
    window.afazeresPickerRunning = false;
  }
})();
