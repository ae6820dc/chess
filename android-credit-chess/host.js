/* Android host helpers. Original HTML and scripts remain byte-identical. */
(() => {
  if (window.studioDownload) return;
  const program = location.hostname.split('.')[0];
  const formKey = '__studio_generator_form_v1';
  // Versions 1 and 2 have no original storage API. Keep their seeded generator
  // controls in host-owned storage without changing any original key or ID.
  if (document.getElementById('generate') && document.getElementById('seed')) {
    const controls = [...document.querySelectorAll('input[id],select[id],textarea[id]')];
    try {
      const saved = JSON.parse(localStorage.getItem(formKey) || 'null');
      if (saved) {
        for (const el of controls) if (typeof saved[el.id] === 'string') el.value = saved[el.id];
        if (typeof generate === 'function') generate();
      }
    } catch (error) { console.warn('Generator form restore failed', error); }
    window.studioSaveForm = () => {
      try { localStorage.setItem(formKey, JSON.stringify(Object.fromEntries(controls.map(el => [el.id, el.value])))); }
      catch (error) { console.warn('Generator form save failed', error); }
    };
    document.addEventListener('change', window.studioSaveForm);
    document.addEventListener('input', window.studioSaveForm);
    document.addEventListener('click', () => setTimeout(window.studioSaveForm, 0));
    window.studioSaveForm();
  }
  window.studioDownload = async (url, name) => {
    try {
      const blob = await (await fetch(url)).blob();
      if (blob.size > 32 * 1024 * 1024) throw Error('File exceeds 32 MB');
      const reader = new FileReader();
      reader.onload = () => StudioDownloads.save(name || 'download', blob.type || 'application/octet-stream', String(reader.result).split(',')[1]);
      reader.onerror = () => StudioDownloads.error('Cannot read download');
      reader.readAsDataURL(blob);
    } catch (error) { StudioDownloads.error(String(error.message)); }
  };
  // Original exporters call click() on detached anchors, which never bubble
  // to document. Route those downloads to Android's document picker too.
  const anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download') && /^(blob:|data:)/.test(this.href)) {
      window.studioDownload(this.href, this.download); return;
    }
    return anchorClick.call(this);
  };
  // Capture the original filenames before WebView's DownloadListener loses them.
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[download]');
    if (anchor && /^(blob:|data:)/.test(anchor.href)) {
      event.preventDefault(); window.studioDownload(anchor.href, anchor.download);
    }
  }, true);
  window.studioExport = () => {
    const payload = { schema: 1, program, localStorage: Object.fromEntries(Object.entries(localStorage)) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    window.studioDownload(url, program + '-state.json').finally(() => setTimeout(() => URL.revokeObjectURL(url), 10000));
  };
})();
