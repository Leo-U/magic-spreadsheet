// Preferences are independent of study data. Run before CSS to avoid a light flash.
(() => {
  const key = 'learning-insights-theme';
  let theme = 'dark';
  try { if (localStorage.getItem(key) === 'light') theme = 'light'; } catch {}
  document.documentElement.dataset.theme = theme;
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('#theme-toggle');
    const update = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      toggle.setAttribute('aria-checked', String(dark));
      toggle.querySelector('span').textContent = dark ? 'On' : 'Off';
    };
    update();
    toggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      update();
      try { localStorage.setItem(key, next); } catch {
        // The theme still works for this visit when browser storage is unavailable.
      }
    });
  });
})();
