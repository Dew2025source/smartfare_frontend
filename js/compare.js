// ─────────────────────────────────────────────
// Compare page — Current location + geocoded search
// ─────────────────────────────────────────────

const API_BASE = "https://smartfarebackend-production.up.railway.app";

let fromValue = '';
let toValue = '';
let fromLocation = null;
let toLocation = null;
let allLocations = [];
let searchTimers = {};

const CURRENT_LOCATION_NAME = 'Current Location';

// ─── INIT ───────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadLocations();
  initLocationSearch('from', 'fromInput', 'fromClear', 'fromSuggestions');
  initLocationSearch('to', 'toInput', 'toClear', 'toSuggestions');
  setupCurrentLocation();
  setupSwap();
  setupCompareBtn();
  loadPopularRoutes();
  setupOutsideClick();
});

// ─── LOAD KNOWN LOCATIONS ───────────────────
async function loadLocations() {
  try {
    const res = await fetch(`${API_BASE}/api/locations`);
    const data = await res.json();
    if (data.success) allLocations = data.data.locations || [];
  } catch (e) {
    console.error('Error loading locations:', e);
  }
}

// ─── SEARCHABLE LOCATION WIDGET ─────────────
function initLocationSearch(side, inputId, clearId, suggestionsId) {
  const input = document.getElementById(inputId);
  const clearBtn = document.getElementById(clearId);
  const suggestions = document.getElementById(suggestionsId);
  let highlightIdx = -1;

  if (!input || !clearBtn || !suggestions) return;

  input.addEventListener('input', () => {
    const q = input.value.trim();

    if (side === 'from') {
      fromValue = '';
      fromLocation = null;
    } else {
      toValue = '';
      toLocation = null;
    }

    updateCompareButton();
    clearBtn.classList.toggle('visible', q.length > 0);
    highlightIdx = -1;

    if (q.length === 0) {
      closeSuggestions(suggestions);
      return;
    }

    renderSuggestions(q, suggestions, input, clearBtn, side);
  });

  input.addEventListener('focus', () => {
    const q = input.value.trim();
    if (q.length > 0) renderSuggestions(q, suggestions, input, clearBtn, side);
  });

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
      if (highlightIdx >= 0 && items[highlightIdx]) items[highlightIdx].click();
      else handleCompare();
    } else if (e.key === 'Escape') {
      closeSuggestions(suggestions);
      input.blur();
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.remove('visible');
    input.classList.remove('has-value');
    if (side === 'from') {
      fromValue = '';
      fromLocation = null;
    } else {
      toValue = '';
      toLocation = null;
    }
    closeSuggestions(suggestions);
    updateCompareButton();
    clearError();
    input.focus();
  });
}

// ─── CURRENT LOCATION ───────────────────────
function setupCurrentLocation() {
  const btn = document.getElementById('currentLocationBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    clearError();

    if (!navigator.geolocation) {
      showError('Current location is not supported in this browser.');
      return;
    }

    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border-custom me-2"></span> Detecting…';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let detectedName = CURRENT_LOCATION_NAME;
        let detectedDisplayName = `Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;

        try {
          btn.innerHTML = '<span class="spinner-border-custom me-2"></span> Finding area name…';
          const reverseRes = await fetch(`${API_BASE}/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
          const reverseData = await reverseRes.json();
          const location = reverseData.success ? reverseData.data.location : null;

          if (location) {
            detectedName = location.name || detectedName;
            detectedDisplayName = location.displayName || detectedDisplayName;
          }
        } catch (error) {
          console.warn('Reverse geocode failed:', error);
        }

        fromValue = detectedName;
        fromLocation = {
          name: detectedName,
          displayName: detectedDisplayName,
          lat,
          lng,
          source: 'browser-current-location'
        };

        const fromInput = document.getElementById('fromInput');
        const fromClear = document.getElementById('fromClear');
        if (fromInput) {
          fromInput.value = detectedName;
          fromInput.title = detectedDisplayName;
        }
        syncInputState(fromInput, fromClear, fromValue);

        btn.disabled = false;
        btn.innerHTML = original;
        updateCompareButton();
        clearError();
      },
      () => {
        btn.disabled = false;
        btn.innerHTML = original;
        showError('Location permission denied. Allow location access and try again.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

// ─── RENDER SUGGESTIONS ─────────────────────
function renderSuggestions(query, panel, input, clearBtn, side) {
  const q = query.toLowerCase();
  const localMatches = allLocations
    .filter(loc => loc.toLowerCase().includes(q))
    .slice(0, 5)
    .map(loc => ({ name: loc, displayName: loc, source: 'local' }));

  renderSuggestionItems(localMatches, query, panel, input, clearBtn, side, true);

  clearTimeout(searchTimers[side]);
  searchTimers[side] = setTimeout(async () => {
    if (query.trim().length < 3) return;

    try {
      const res = await fetch(`${API_BASE}/api/geocode/search?q=${encodeURIComponent(query)}&limit=8`);
      const data = await res.json();
      const remoteMatches = data.success ? (data.data.locations || []) : [];
      renderSuggestionItems(remoteMatches, query, panel, input, clearBtn, side, false);
    } catch (error) {
      console.error('Geocode search error:', error);
      if (localMatches.length === 0) renderEmptySuggestion(panel, 'Search failed. Try a known nearby place.');
    }
  }, 350);
}

function renderSuggestionItems(matches, query, panel, input, clearBtn, side, loadingRemote) {
  if (!matches.length && loadingRemote) {
    panel.innerHTML = `<div class="suggestion-empty">Searching more places…</div>`;
    openSuggestions(panel);
    return;
  }

  if (!matches.length) {
    renderEmptySuggestion(panel, 'Location not found');
    return;
  }

  panel.innerHTML = matches.map((loc, idx) => `
    <div class="suggestion-item" data-index="${idx}" role="option">
      <span class="suggestion-icon">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1C4.567 1 3 2.567 3 4.5c0 2.625 3.5 7.5 3.5 7.5S10 7.125 10 4.5C10 2.567 8.433 1 6.5 1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          <circle cx="6.5" cy="4.5" r="1.2" stroke="currentColor" stroke-width="1.1"/>
        </svg>
      </span>
      <span class="suggestion-text">
        ${highlightMatch(loc.name || loc.displayName || query, query)}
        ${loc.displayName && loc.displayName !== loc.name ? `<small class="suggestion-subtext">${escapeHtml(shortDisplayName(loc.displayName))}</small>` : ''}
      </span>
      <span class="suggestion-source">${loc.source === 'local' ? 'Saved' : 'Map'}</span>
    </div>
  `).join('');

  panel.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('mousedown', e => e.preventDefault());
    item.addEventListener('click', () => {
      const loc = matches[Number(item.dataset.index)];
      selectLocation(side, loc, input, clearBtn, panel);
    });
  });

  openSuggestions(panel);
}

function renderEmptySuggestion(panel, text) {
  panel.innerHTML = `
    <div class="suggestion-empty">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.4"/>
        <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
      ${escapeHtml(text)}
    </div>`;
  openSuggestions(panel);
}

function selectLocation(side, loc, input, clearBtn, panel) {
  const label = loc.name || loc.displayName || input.value.trim();
  input.value = label;
  input.classList.add('has-value');
  clearBtn.classList.add('visible');

  const selected = {
    name: label,
    displayName: loc.displayName || label,
    lat: Number(loc.lat),
    lng: Number(loc.lng),
    source: loc.source || 'local'
  };

  if (side === 'from') {
    fromValue = label;
    fromLocation = Number.isFinite(selected.lat) && Number.isFinite(selected.lng) ? selected : null;
  } else {
    toValue = label;
    toLocation = Number.isFinite(selected.lat) && Number.isFinite(selected.lng) ? selected : null;
  }

  closeSuggestions(panel);
  updateCompareButton();
  clearError();
  loadPopularRoutes();
}

// ─── HELPERS ────────────────────────────────
function highlightMatch(text, query) {
  text = String(text || '');
  query = String(query || '');
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtml(text);
  return escapeHtml(text.slice(0, idx)) + `<mark>${escapeHtml(text.slice(idx, idx + query.length))}</mark>` + escapeHtml(text.slice(idx + query.length));
}

function shortDisplayName(displayName) {
  return String(displayName).split(',').slice(0, 3).join(',').trim();
}

function applyHighlight(items, idx) {
  items.forEach((item, i) => item.classList.toggle('highlighted', i === idx));
  if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
}

function openSuggestions(panel) { panel.classList.add('open'); }
function closeSuggestions(panel) { panel.classList.remove('open'); }

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

// ─── SWAP ───────────────────────────────────
function setupSwap() {
  document.getElementById('swapBtn')?.addEventListener('click', () => {
    const fromInput = document.getElementById('fromInput');
    const toInput = document.getElementById('toInput');
    const fromClear = document.getElementById('fromClear');
    const toClear = document.getElementById('toClear');
    if (!fromInput || !toInput) return;

    [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
    [fromValue, toValue] = [toValue, fromValue];
    [fromLocation, toLocation] = [toLocation, fromLocation];

    syncInputState(fromInput, fromClear, fromValue);
    syncInputState(toInput, toClear, toValue);

    updateCompareButton();
      clearError();
    loadPopularRoutes();
  });
}

function syncInputState(input, clearBtn, value) {
  if (!input || !clearBtn) return;
  input.classList.toggle('has-value', !!value);
  clearBtn.classList.toggle('visible', !!value);
}

// ─── COMPARE BUTTON ─────────────────────────
function setupCompareBtn() {
  document.getElementById('compareBtn')?.addEventListener('click', handleCompare);
}

function updateCompareButton() {
  const btn = document.getElementById('compareBtn');
  if (btn) btn.disabled = !(fromValue && toValue && fromValue !== toValue);
}

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
    let data;

    if (fromLocation || toLocation) {
      const res = await fetch(`${API_BASE}/api/route/coords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromLocation || fromValue,
          to: toLocation || toValue
        })
      });
      data = await res.json();
    } else {
      const res = await fetch(`${API_BASE}/api/route?from=${encodeURIComponent(fromValue)}&to=${encodeURIComponent(toValue)}`);
      data = await res.json();
    }

    if (!data.success) {
      showError(data.message || `No route found between ${fromValue} and ${toValue}.`);
      btn.innerHTML = original;
      btn.disabled = false;
      return;
    }

    await new Promise(r => setTimeout(r, 400));
    const route = data.data.route;
    const params = new URLSearchParams({
      from: route.from || fromValue,
      to: route.to || toValue,
      distance: route.distance,
      source: route.source || 'osrm'
    });

    if (route.durationMinutes) params.set('duration', route.durationMinutes);
    if (route.fromCoords) {
      params.set('fromLat', route.fromCoords.lat);
      params.set('fromLng', route.fromCoords.lng);
    }
    if (route.toCoords) {
      params.set('toLat', route.toCoords.lat);
      params.set('toLng', route.toCoords.lng);
    }

    window.location.href = `/results?${params.toString()}`;
  } catch (e) {
    console.error('Route check error:', e);
    showError('Error checking route. Please try again.');
    btn.innerHTML = original;
    btn.disabled = false;
  }
}

// ─── POPULAR ROUTES ─────────────────────────
function loadPopularRoutes() {
  const popularRoutes = [
    { from: 'Rohini', to: 'Connaught Place', distance: 18 },
    { from: 'Dwarka', to: 'Connaught Place', distance: 22 },
    { from: 'Noida Sector 18', to: 'Connaught Place', distance: 22 },
    { from: 'Gurgaon', to: 'Connaught Place', distance: 28 },
    { from: 'IGI Airport', to: 'Connaught Place', distance: 16 },
    { from: 'Lajpat Nagar', to: 'Connaught Place', distance: 8 },
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
  const toInput = document.getElementById('toInput');
  const fromClear = document.getElementById('fromClear');
  const toClear = document.getElementById('toClear');
  if (!fromInput || !toInput) return;

  fromInput.value = from;
  toInput.value = to;
  fromValue = from;
  toValue = to;
  fromLocation = null;
  toLocation = null;

  syncInputState(fromInput, fromClear, fromValue);
  syncInputState(toInput, toClear, toValue);

  updateCompareButton();
  clearError();
  loadPopularRoutes();
}

// ─── ERROR HELPERS ──────────────────────────
function clearError() {
  const el = document.getElementById('errorMessage');
  if (el) el.classList.add('d-none');
}

function showError(msg) {
  const el = document.getElementById('errorMessage');
  if (el) {
    el.textContent = msg;
    el.classList.remove('d-none');
  }
}

// ─── UTILS ──────────────────────────────────
function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
