// Prevents flash of wrong theme on initial load.
// Must run synchronously before React renders.
document.documentElement.classList.toggle(
  'dark',
  (localStorage.getItem('rackifai-theme') ?? 'dark') !== 'light'
);
