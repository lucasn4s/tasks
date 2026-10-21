export function startPicker(tabId) {
  return chrome.scripting.executeScript({ target: { tabId }, files: ['picker.js'] });
}
