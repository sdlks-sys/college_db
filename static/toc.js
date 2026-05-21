document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('toc-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const items = document.querySelectorAll('.toc-item');
    items.forEach(li => {
      const text = li.innerText.toLowerCase();
      li.style.display = text.includes(q) ? '' : 'none';
    });
  });
});
