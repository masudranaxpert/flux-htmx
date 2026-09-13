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

    // Bulk update: set every checkbox and row highlight directly, then notify once.
    // Dispatching a change per checkbox would fire one htmx request per row.
    for (const cb of checkboxes) {
      cb.checked = isChecked;
      const row = cb.closest('tr');
      if (row) {
        if (isChecked) {
          row.setAttribute('data-selected', 'true');
        } else {
          row.removeAttribute('data-selected');
        }
      }
    }
    table.dispatchEvent(
      new CustomEvent('flux:select-all', {
        bubbles: true,
        detail: { checked: isChecked, count: checkboxes.length },
      }),
    );
  } else if (target.hasAttribute('fx-select')) {
    const table = target.closest('table') || target.closest('[fx-table]');
    if (!table) return;

    const selectAll = table.querySelector('[fx-select-all]') as HTMLInputElement;
    if (selectAll) {
      const checkboxes = queryAllSafely('[fx-select]', table) as Element[] as HTMLInputElement[];
      const allChecked = checkboxes.every((cb) => cb.checked);
      const someChecked = checkboxes.some((cb) => cb.checked);

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
