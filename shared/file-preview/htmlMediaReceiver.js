// Loaded as an external asset so the opaque iframe can retain the desktop's strict script policy.
(() => {
  const channel = document.currentScript?.dataset.channel;
  window.addEventListener('message', event => {
    if (!channel || event.source !== parent || event.data?.channel !== channel) return;
    const { id, attribute, value } = event.data;
    if (!['src', 'poster', 'srcset'].includes(attribute) || typeof id !== 'string'
      || !/^\d+$/.test(id) || typeof value !== 'string') return;
    const marker = `data-preview-${attribute}`;
    document.querySelectorAll(`[${marker}="${id}"]`).forEach(element => {
      // Preserve selections made by page scripts while the initial resource was still loading.
      if (!element.hasAttribute(attribute)) element.setAttribute(attribute, value);
      element.removeAttribute(marker);
      if (element.tagName === 'SOURCE' && element.parentElement instanceof HTMLMediaElement) {
        element.parentElement.load();
      }
    });
  });
})();
