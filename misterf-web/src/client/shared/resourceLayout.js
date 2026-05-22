export function initializeResourceLayoutToggle(rootSelector, storageKey) {
  const root = document.querySelector(rootSelector);
  if (!root) {
    return;
  }

  const toggleButtons = Array.from(
    root.querySelectorAll('[data-resource-layout-toggle]'),
  );
  if (toggleButtons.length === 0) {
    return;
  }

  const allowedLayouts = new Set(['cards', 'list']);
  const storedValue = window.localStorage.getItem(storageKey) || '';
  const initialLayout = allowedLayouts.has(storedValue) ? storedValue : 'cards';

  const applyLayout = (layout) => {
    const normalizedLayout = allowedLayouts.has(layout) ? layout : 'cards';
    root.dataset.resourceLayout = normalizedLayout;
    window.localStorage.setItem(storageKey, normalizedLayout);

    for (const element of root.querySelectorAll('[data-resource-layout-cards-class], [data-resource-layout-list-class]')) {
      const cardsClassValue =
        element.getAttribute('data-resource-layout-cards-class') || '';
      const listClassValue =
        element.getAttribute('data-resource-layout-list-class') || '';
      const cardsClasses = cardsClassValue.split(/\s+/).filter(Boolean);
      const listClasses = listClassValue.split(/\s+/).filter(Boolean);

      element.classList.remove(...cardsClasses, ...listClasses);
      element.classList.add(...(normalizedLayout === 'list' ? listClasses : cardsClasses));
    }

    for (const button of toggleButtons) {
      const isActive =
        button.getAttribute('data-resource-layout-toggle') === normalizedLayout;
      button.classList.toggle('btn-primary', isActive);
      button.classList.toggle('btn-secondary', !isActive);
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  };

  for (const button of toggleButtons) {
    button.addEventListener('click', () => {
      applyLayout(button.getAttribute('data-resource-layout-toggle') || 'cards');
    });
  }

  applyLayout(initialLayout);
}
