const list = document.getElementById('list');
const panel = document.getElementById('panel');
const status = document.getElementById('status');

function formatPreview(text) {
  if (!text) return 'Empty';
  const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;
  return preview.replace(/\s+/g, ' ').trim();
}

function render(state) {
  panel.classList.toggle('off', !state.enabled);
  status.textContent = state.enabled ? 'Active' : 'Paused';
  list.innerHTML = '';

  state.slots.forEach((text, i) => {
    const li = document.createElement('li');

    const cap = document.createElement('span');
    cap.className = 'cap';
    cap.textContent = i + 1;

    const txt = document.createElement('span');
    txt.className = 'txt';
    txt.textContent = formatPreview(text);

    if (!text) {
      li.classList.add('empty');
    }
    if (i === state.next) {
      li.classList.add('next');
    }

    li.append(cap, txt);
    list.append(li);
  });
}

if (window.api) {
  window.api.onSlotsUpdate(render);
  window.api.getState().then(render);
}
