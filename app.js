// Simple offline-capable Pok app (no backend). Uses localStorage for persistence.
const video = document.getElementById('video');
const snap = document.getElementById('snap');
const fileInput = document.getElementById('fileInput');
const canvas = document.getElementById('canvas');
const cardForm = document.getElementById('cardForm');
const cardsList = document.getElementById('cardsList');
const noCards = document.getElementById('noCards');
const chart = document.getElementById('chart');
const exportBtn = document.getElementById('export');
const clearBtn = document.getElementById('clear');

let collection = JSON.parse(localStorage.getItem('pok_collection') || '[]');

function startCamera() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => { video.srcObject = stream; })
      .catch(() => { console.log('No camera or permission denied'); });
  }
}
startCamera();

snap.addEventListener('click', () => {
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  // For now we just create a new card with the snapshot as preview name
  const name = 'Scatto ' + new Date().toLocaleTimeString();
  addCard({ name, expansion: 'Scatti', language: 'IT', condition: 'Mint', image: dataUrl });
});

fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const name = f.name || ('Immagine ' + new Date().toLocaleTimeString());
    addCard({ name, expansion: 'Galleria', language: 'IT', condition: 'Near Mint', image: dataUrl });
  };
  reader.readAsDataURL(f);
});

cardForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('cardName').value.trim();
  const expansion = document.getElementById('expansion').value.trim();
  const language = document.getElementById('language').value;
  const condition = document.getElementById('condition').value;
  if (!name || !expansion) return alert('Inserisci nome ed espansione');
  addCard({ name, expansion, language, condition });
  cardForm.reset();
});

function addCard(card) {
  // Simulated price (random but stable for this session)
  card.id = 'c_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
  card.added = new Date().toISOString();
  card.simulatedPrice = simulatePrice(card.name);
  card.history = generateHistory(card.simulatedPrice);
  collection.unshift(card);
  persist();
  render();
}

function simulatePrice(name) {
  // Simple deterministic-ish pseudo-random based on name
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  hash = Math.abs(hash);
  const base = 1 + (hash % 80); // 1 - 80
  return Math.round(base * (1 + ((hash % 7) - 3) / 10)); // adjust a bit
}

function generateHistory(price) {
  // generate 6 monthly points
  const arr = [];
  for (let i = 5; i >= 0; i--) {
    const v = Math.max(0.5, Math.round((price * (0.8 + Math.random() * 0.6)) * 100) / 100);
    arr.push({ date: new Date(Date.now() - i * 30 * 24 * 3600 * 1000).toISOString().slice(0, 10), value: v });
  }
  return arr;
}

function persist() { localStorage.setItem('pok_collection', JSON.stringify(collection)); }

function render() {
  cardsList.innerHTML = '';
  if (collection.length === 0) { noCards.style.display = 'block'; return }
  noCards.style.display = 'none';
  collection.forEach(c => {
    const li = document.createElement('li');
    li.className = 'cardItem';
    const left = document.createElement('div');
    left.innerHTML = '<strong>' + escapeHtml(c.name) + '</strong><div class="cardMeta">' + escapeHtml(c.expansion) + ' · ' + c.language + ' · ' + c.condition + '</div>';
    const right = document.createElement('div');
    right.innerHTML = '<div style="text-align:right"><div>' + c.simulatedPrice + '€</div><div class="cardMeta">aggiunta: ' + (new Date(c.added)).toLocaleDateString() + '</div></div>';
    const btns = document.createElement('div');
    const view = document.createElement('button');
    view.textContent = 'Grafico';
    view.style.marginLeft = '8px';
    view.onclick = () => { drawChartFor(c); };
    const del = document.createElement('button');
    del.textContent = 'Elimina';
    del.onclick = () => { if (confirm('Eliminare questa carta?')) { collection = collection.filter(x => x.id !== c.id); persist(); render(); } };
    btns.appendChild(view); btns.appendChild(del);
    li.appendChild(left); li.appendChild(right); li.appendChild(btns);
    cardsList.appendChild(li);
  });
  drawChartFor(collection[0]);
}

function drawChartFor(card) {
  const ctx = chart.getContext('2d');
  // clear
  ctx.clearRect(0, 0, chart.width, chart.height);
  // axes
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#444';
  ctx.fillText(card.name + ' — valori simulati', 6, 14);
  // compute points
  const padding = 28;
  const w = chart.width - padding * 2;
  const h = chart.height - padding * 2;
  const values = card.history.map(x => x.value);
  const maxV = Math.max(...values) * 1.15;
  const minV = Math.min(...values) * 0.85;
  // draw line
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = padding + (i / (values.length - 1)) * w;
    const y = padding + (1 - (v - minV) / (maxV - minV)) * h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#6A4C9A'; // purple
  ctx.stroke();
  // fill soft
  ctx.lineTo(padding + w, padding + h);
  ctx.lineTo(padding, padding + h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(79,209,197,0.12)';
  ctx.fill();
  // points
  values.forEach((v, i) => {
    const x = padding + (i / (values.length - 1)) * w;
    const y = padding + (1 - (v - minV) / (maxV - minV)) * h;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = '#6A4C9A'; ctx.fill();
  });
}

// Utility to escape HTML entities
function escapeHtml(str) {
  return (str || '').replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'pok_collection.json'; a.click();
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener('click', () => {
  if (confirm('Vuoi cancellare tutta la collezione?')) { collection = []; persist(); render(); }
});

// initial render
render();
