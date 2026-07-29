import { queryAllSafely } from '../core/selectors.js';

export function installTable() {
  document.addEventListener('change', handleTableChange);
}

function handleTableChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (!target || target.type !== 'checkbox') return;

  if (target.hasAttribute('fx-select-all')) {
    const table = target.closest('table') || target.closest('[fx-table]');
    if (!table) return;

    const isChecked = target.checked;
    const checkboxes = queryAllSafely('[fx-select]', table) as Element[] as HTMLInputElement[];
    
    for (const cb of checkboxes) {
      if (cb.checked !== isChecked) {
        cb.checked = isChecked;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  } else if (target.hasAttribute('fx-select')) {
    const table = target.closest('table') || target.closest('[fx-table]');
    if (!table) return;

    const selectAll = table.querySelector('[fx-select-all]') as HTMLInputElement;
    if (selectAll) {
      const checkboxes = queryAllSafely('[fx-select]', table) as Element[] as HTMLInputElement[];
      const allChecked = checkboxes.every(cb => cb.checked);
      const someChecked = checkboxes.some(cb => cb.checked);
      
      selectAll.checked = allChecked;
      selectAll.indeterminate = someChecked && !allChecked;
    }
    
    // Highlight row
    const row = target.closest('tr');
    if (row) {
      if (target.checked) {
        row.setAttribute('data-selected', 'true');
      } else {
        row.removeAttribute('data-selected');
      }
    }
  }
}
