// ─────────────────────────────────────────────
// Compare page — Searchable Location Inputs
// ─────────────────────────────────────────────

const API_BASE = window.location.origin;

// Selected location values (the "real" state)
let fromValue = '';
let toValue   = '';

// All locations from API
let allLocations = [];

// ─── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadLocations();
  initLocationSearch('from', 'fromInput', 'fromClear', 'fromSuggestions');
  initLocationSearch('to',   'toInput',   'toClear',   'toSuggestions');
  setupSwap();
  setupCompareBtn();
  loadPopularRoutes();
  setupOutsideClick();
});

// ─── LOAD LOCATIONS ─────────────────────────
async function loadLocations() {
  try {
    const res  = await fetch(`${API_BASE}/api/locations`);
    const data = await res.json();
    if (data.success) allLocations = data.data.locations;
  } catch (e) {
    console.error('Error loading locations:', e);
  }
}

// ─── SEARCHABLE LOCATION WIDGET ─────────────
/**
 * @param {string} side          - 'from' | 'to'
 * @param {string} inputId       - input element id
 * @param {string} clearId       - clear button id
 * @param {string} suggestionsId - suggestions panel id
 */
function initLocationSearch(side, inputId, clearId, suggestionsId) {
  const input       = document.getElementById(inputId);
  const clearBtn    = document.getElementById(clearId);
  const suggestions = document.getElementById(suggestionsId);
  let highlightIdx  = -1;

  if (!input || !clearBtn || !suggestions) return;

  // ── Typing ──────────────────────────────
  input.addEventListener('input', () => {
    const q = input.value.trim();

    // If user edits after selecting, clear the stored value
    if (side === 'from' && fromValue && input.value !== fromValue) fromValue = '';
    if (side === 'to'   && toValue   && input.value !== toValue)   toValue   = '';
    updateCompareButton();

    clearBtn.classList.toggle('visible', q.length > 0);
    highlightIdx = -1;

    if (q.length === 0) {
      closeSuggestions(suggestions);
      return;
    }
    renderSuggestions(q, suggestions, input, clearBtn, side);
  });

  // ── Focus: re-show if has text ───────────
  input.addEventListener('focus', () => {
    const q = input.value.trim();
    if (q.length > 0) {
      renderSuggestions(q, suggestions, input, clearBtn, side);
    }
  });

  // ── Keyboard nav ────────────────────────
  input.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('.suggestion-item');
    if (!suggestions.classList.contains('open') || items.length === 0) {
      if (e.key === 'Enter') handleCompare();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightIdx = Math.min(highlightIdx + 1, items.length - 1);
      applyHighlight(items, highlightIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIdx = Math.max(highlightIdx - 1, 0);
      applyHighlight(items, highlightIdx);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && items[highlightIdx]) {
        items[highlightIdx].click();
      } else {
        handleCompare();
      }
    } else if (e.key === 'Escape') {
      closeSuggestions(suggestions);
      input.blur();
    }
  });

  // ── Clear button ────────────────────────
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.remove('visible');
    input.classList.remove('has-value');
    if (side === 'from') fromValue = '';
    if (side === 'to')   toValue   = '';
    closeSuggestions(suggestions);
    updateCompareButton();
    clearError();
    input.focus();
  });
}

// ─── RENDER SUGGESTIONS ─────────────────────
function renderSuggestions(query, panel, input, clearBtn, side) {
  const q       = query.toLowerCase();
  const matches = allLocations.filter(loc => loc.toLowerCase().includes(q)).slice(0, 6);

  if (matches.length === 0) {
    panel.innerHTML = `
      <div class="suggestion-empty">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.4"/>
          <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        Location not available
      </div>`;
    openSuggestions(panel);
    return;
  }

  panel.innerHTML = matches.map(loc => `
    <div class="suggestion-item" data-loc="${escapeAttr(loc)}" role="option">
      <span class="suggestion-icon">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1C4.567 1 3 2.567 3 4.5c0 2.625 3.5 7.5 3.5 7.5S10 7.125 10 4.5C10 2.567 8.433 1 6.5 1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          <circle cx="6.5" cy="4.5" r="1.2" stroke="currentColor" stroke-width="1.1"/>
        </svg>
      </span>
      <span class="suggestion-text">${highlightMatch(loc, query)}</span>
    </div>
  `).join('');

  // Bind click
  panel.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur before click fires
    });
    item.addEventListener('click', () => {
      const loc = item.dataset.loc;
      input.value = loc;
      input.classList.add('has-value');
      clearBtn.classList.add('visible');
      if (side === 'from') fromValue = loc;
      if (side === 'to')   toValue   = loc;
      closeSuggestions(panel);
      updateCompareButton();
      clearError();
      loadPopularRoutes();
    });
  });

  openSuggestions(panel);
}

// ─── HIGHLIGHT MATCH ────────────────────────
function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtml(text);
  return (
    escapeHtml(text.slice(0, idx)) +
    `<mark>${escapeHtml(text.slice(idx, idx + query.length))}</mark>` +
    escapeHtml(text.slice(idx + query.length))
  );
}

// ─── KEYBOARD HIGHLIGHT ─────────────────────
function applyHighlight(items, idx) {
  items.forEach((item, i) => item.classList.toggle('highlighted', i === idx));
  if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
}

// ─── OPEN / CLOSE SUGGESTIONS ───────────────
function openSuggestions(panel)  { panel.classList.add('open'); }
function closeSuggestions(panel) { panel.classList.remove('open'); }

// ─── OUTSIDE CLICK ──────────────────────────
function setupOutsideClick() {
  document.addEventListener('click', (e) => {
    ['fromWrap', 'toWrap'].forEach(wrapId => {
      const wrap = document.getElementById(wrapId);
      if (wrap && !wrap.contains(e.target)) {
        const panel = wrap.querySelector('.location-suggestions');
        if (panel) closeSuggestions(panel);
      }
    });
  });
}

// ─── SWAP ────────────────────────────────────
function setupSwap() {
  document.getElementById('swapBtn')?.addEventListener('click', () => {
    const fromInput = document.getElementById('fromInput');
    const toInput   = document.getElementById('toInput');
    const fromClear = document.getElementById('fromClear');
    const toClear   = document.getElementById('toClear');
    if (!fromInput || !toInput) return;

    // Swap display text
    [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
    // Swap stored values
    [fromValue, toValue] = [toValue, fromValue];

    // Sync has-value class + clear visibility
    syncInputState(fromInput, fromClear, fromValue);
    syncInputState(toInput,   toClear,   toValue);

    updateCompareButton();
    clearError();
    loadPopularRoutes();
  });
}

function syncInputState(input, clearBtn, value) {
  input.classList.toggle('has-value', !!value);
  clearBtn.classList.toggle('visible', !!value);
}

// ─── COMPARE BUTTON ──────────────────────────
function setupCompareBtn() {
  document.getElementById('compareBtn')?.addEventListener('click', handleCompare);
}

function updateCompareButton() {
  const btn = document.getElementById('compareBtn');
  if (btn) btn.disabled = !(fromValue && toValue && fromValue !== toValue);
}

// ─── HANDLE COMPARE ──────────────────────────
async function handleCompare() {
  clearError();
  if (!fromValue || !toValue) {
    showError('Please select both pickup and drop-off locations.');
    return;
  }
  if (fromValue === toValue) {
    showError('Pickup and drop-off cannot be the same location.');
    return;
  }

  const btn = document.getElementById('compareBtn');
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border-custom me-2"></span> Finding best fares…';
  btn.disabled = true;

  try {
    const res  = await fetch(`${API_BASE}/api/route?from=${encodeURIComponent(fromValue)}&to=${encodeURIComponent(toValue)}`);
    const data = await res.json();

    if (!data.success) {
      showError(`No direct route found between ${fromValue} and ${toValue}. Try swapping or picking nearby locations.`);
      btn.innerHTML = original;
      btn.disabled = false;
      return;
    }

    await new Promise(r => setTimeout(r, 600));
    const params = new URLSearchParams({ from: fromValue, to: toValue, distance: data.data.route.distance });
    window.location.href = `/results?${params.toString()}`;
  } catch (e) {
    console.error('Route check error:', e);
    showError('Error checking route. Please try again.');
    btn.innerHTML = original;
    btn.disabled  = false;
  }
}

// ─── POPULAR ROUTES ──────────────────────────
function loadPopularRoutes() {
  const popularRoutes = [
    { from: 'Rohini',          to: 'Connaught Place', distance: 18 },
    { from: 'Dwarka',          to: 'Connaught Place', distance: 22 },
    { from: 'Noida Sector 18', to: 'Connaught Place', distance: 22 },
    { from: 'Gurgaon',         to: 'Connaught Place', distance: 28 },
    { from: 'IGI Airport',     to: 'Connaught Place', distance: 16 },
    { from: 'Lajpat Nagar',    to: 'Connaught Place', distance: 8  },
  ];

  const container = document.getElementById('popularRoutesContainer');
  if (!container) return;

  container.innerHTML = popularRoutes.map(route => `
    <button
      class="popular-route-btn ${fromValue === route.from && toValue === route.to ? 'active' : ''}"
      onclick="selectPopularRoute('${escapeAttr(route.from)}', '${escapeAttr(route.to)}')"
    >
      <span class="route-indicator"></span>
      <div class="flex-grow-1 small">
        <span class="fw-medium">${escapeHtml(route.from)}</span>
        <span class="text-muted mx-1">→</span>
        <span class="text-muted">${escapeHtml(route.to)}</span>
      </div>
      <span class="small text-muted">${route.distance}km</span>
    </button>
  `).join('');
}

function selectPopularRoute(from, to) {
  const fromInput = document.getElementById('fromInput');
  const toInput   = document.getElementById('toInput');
  const fromClear = document.getElementById('fromClear');
  const toClear   = document.getElementById('toClear');
  if (!fromInput || !toInput) return;

  fromInput.value = from;
  toInput.value   = to;
  fromValue = from;
  toValue   = to;

  syncInputState(fromInput, fromClear, fromValue);
  syncInputState(toInput,   toClear,   toValue);

  updateCompareButton();
  clearError();
  loadPopularRoutes();
}

// ─── ERROR HELPERS ────────────────────────────
function clearError() {
  const el = document.getElementById('errorMessage');
  if (el) el.classList.add('d-none');
}

function showError(msg) {
  const el = document.getElementById('errorMessage');
  if (el) { el.textContent = msg; el.classList.remove('d-none'); }
}

// ─── UTILS ────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeAttr(str) {
  return str.replace(/'/g, "\\'");
}