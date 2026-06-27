export function initializeListGroupDropdownStacking(root = document) {
  for (const dropdownEl of root.querySelectorAll('.list-group-item .dropdown')) {
    dropdownEl.addEventListener('show.bs.dropdown', () => {
      dropdownEl.closest('.list-group-item')?.classList.add('dropdown-open');
    });

    dropdownEl.addEventListener('hide.bs.dropdown', () => {
      dropdownEl.closest('.list-group-item')?.classList.remove('dropdown-open');
    });
  }
}
