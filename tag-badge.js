export function renderTagBadge(element, tag) {
  element.classList.add('tag-badge');
  element.textContent = tag.name;
  element.style.setProperty('--tag-color', tag.color);
  return element;
}
