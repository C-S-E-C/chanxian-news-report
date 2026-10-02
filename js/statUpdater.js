const channel = new MessageChannel();
window.channels ||= {};
window.channels.statUpdater = channel.port2;

const statEl = document.getElementById('configStatus');
const stats = new Map();

function render() {
  if (!statEl) return;
  const items = [...stats].map(([name, entry]) => {
    const item = document.createElement('span');
    item.className = 'statItem';
    item.textContent = `${name}: ${entry.value}`;
    if (entry.color) item.style.color = entry.color;
    return item;
  });
  if (!items.length) {
    const item = document.createElement('span');
    item.className = 'statItem';
    item.textContent = '就绪';
    items.push(item);
  }
  statEl.replaceChildren(...items);
}

channel.port1.onmessage = ({ data }) => {
  if (!data || typeof data.name !== 'string') return;
  if (data.value === null || data.exp === 0) {
    stats.delete(data.name);
  } else {
    const seconds = data.exp === -1 ? -1 : typeof data.exp === 'number' ? data.exp : 5;
    stats.set(data.name, {
      value: String(data.value ?? ''),
      color: data.color,
      expiresAt: seconds === -1 ? Infinity : Date.now() + seconds * 1000,
    });
  }
  render();
};
channel.port1.start();

setInterval(() => {
  let changed = false;
  for (const [name, entry] of stats) {
    if (entry.expiresAt <= Date.now()) {
      stats.delete(name);
      changed = true;
    }
  }
  if (changed) render();
}, 1000);
render();
