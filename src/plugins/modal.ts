export function installModal() {
  document.addEventListener('click', handleModalClick);
}

function handleModalClick(e: MouseEvent) {
  const target = e.target as HTMLElement;

  // If we click exactly on a dialog (which means the backdrop in modern browsers when using showModal)
  if (
    target.tagName === 'DIALOG' &&
    (target.hasAttribute('fx-modal') || target.hasAttribute('fx-drawer'))
  ) {
    const dialog = target as HTMLDialogElement;

    // Calculate if click was inside the bounding box of the dialog contents
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInDialog) {
      dialog.close();
      dialog.removeAttribute('open');
    }
  }
}
