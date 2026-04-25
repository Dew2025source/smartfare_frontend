// Results page functionality

const API_BASE = 'https://smartfarebackend-production.up.railway.app';
let fares = [];
let from = '';
let to = '';
let distance = 0;
let duration = 0;
let fromCoords = null;
let toCoords = null;
let resultsMap = null;
let resultsRouteLayer = null;
let resultsMarkerLayer = null;

document.addEventListener('DOMContentLoaded', function () {
  const params = new URLSearchParams(window.location.search);
  from = params.get('from');
  to = params.get('to');
  distance = parseFloat(params.get('distance'));
  duration = parseFloat(params.get('duration')) || 0;

  const fromLat = Number(params.get('fromLat'));
  const fromLng = Number(params.get('fromLng'));
  const toLat = Number(params.get('toLat'));
  const toLng = Number(params.get('toLng'));
  if (Number.isFinite(fromLat) && Number.isFinite(fromLng)) fromCoords = { lat: fromLat, lng: fromLng };
  if (Number.isFinite(toLat) && Number.isFinite(toLng)) toCoords = { lat: toLat, lng: toLng };

  if (from && to && distance) {
    initResultsMap();
    loadResultsRouteMap();
    calculateAndDisplayFares();
  } else {
    window.location.href = '/compare';
  }
});

function renderSkeletons(container, count = 3) {
  container.innerHTML = Array.from({ length: count }).map(() => `
    <div class="fare-skeleton">
      <div class="skel-row skel-header">
        <div class="skel-block skel-icon"></div>
        <div class="skel-col">
          <div class="skel-block skel-title"></div>
          <div class="skel-block skel-sub"></div>
        </div>
        <div class="skel-col skel-right">
          <div class="skel-block skel-price"></div>
          <div class="skel-block skel-eta"></div>
        </div>
      </div>
      <div class="skel-row skel-badges">
        <div class="skel-block skel-badge"></div>
        <div class="skel-block skel-badge"></div>
        <div class="skel-block skel-badge"></div>
      </div>
      <div class="skel-block skel-btn"></div>
    </div>
  `).join('');
}

async function calculateAndDisplayFares() {
  document.getElementById('routeFrom').textContent = from;
  document.getElementById('routeTo').textContent = to;
  document.getElementById('routeDistance').textContent = `${distance} km`;
  updateMapSummary(distance, duration);

  const container = document.getElementById('faresContainer');
  renderSkeletons(container);

  try {
    const response = await fetch(`${API_BASE}/api/fares/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distance }),
    });

    const res = await response.json();

    if (res.success) {
      fares = res.data.fares;
      // Brief pause so skeleton doesn't flash
      await new Promise(r => setTimeout(r, 300));
      displayFares();
    } else {
      throw new Error(res.message || 'Failed to calculate fares');
    }
  } catch (error) {
    console.error('Error calculating fares:', error);
    container.innerHTML = `
      <div class="alert-custom text-center">
        <span style="font-size:1.5rem;display:block;margin-bottom:8px;">⚠️</span>
        Failed to calculate fares. Please try again.
      </div>
    `;
  }
}

function displayFares() {
  const container = document.getElementById('faresContainer');

  if (fares.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No fares available.</p>';
    return;
  }

  const cheapest = fares.reduce((min, f) => f.price < min.price ? f : min, fares[0]);

  container.innerHTML = fares.map((fare, index) => {
    const isCheapest = fare.price === cheapest.price;
    const loginRedirect = `/login?redirect=/results?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&distance=${distance}`;

    return `
      <div class="fare-card${isCheapest ? ' cheapest' : ''}" style="animation: fadeIn 0.4s ease-out ${index * 0.1}s both;">
        ${isCheapest ? '<span class="cheapest-badge">⭐ Best Price</span>' : ''}

        <div class="d-flex justify-content-between align-items-start mb-3">
          <div class="d-flex align-items-center gap-3">
            <span class="service-icon">${fare.icon}</span>
            <div>
              <h5 class="mb-0 fw-bold" style="font-size:1.05rem;">${fare.service}</h5>
              <p class="mb-0 small" style="color:var(--text-muted);">${fare.rideType}</p>
            </div>
          </div>
          <div class="text-end">
            <div class="price-tag">₹${fare.price}</div>
            <p class="mb-0 small" style="color:var(--text-muted);">${fare.eta} ETA</p>
          </div>
        </div>

        <div class="mb-3 d-flex flex-wrap gap-1">
          ${fare.features.map(f => `<span class="feature-badge">${f}</span>`).join('')}
        </div>

        <div class="d-flex gap-2 flex-wrap">
          ${isLoggedIn() ? `
            <button
              class="book-btn flex-grow-1"
              id="bookBtn-${index}"
              onclick="bookRide('${fare.service}', '${fare.rideType}', ${fare.price}, ${index})"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1l1.5 4.5H15l-4.5 3 1.5 4.5L8 10.5 4 13l1.5-4.5L1 5.5h5.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
              </svg>
              Book Now
            </button>
          ` : `
            <a href="${loginRedirect}" class="book-btn flex-grow-1 text-center text-decoration-none">
              Login to Book
            </a>
          `}
          <a href="${fare.appUrl}" target="_blank" rel="noopener noreferrer" class="open-app-btn" style="flex-shrink:0;">
            Open App
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 1h6m0 0v6m0-6L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


function initResultsMap() {
  if (typeof L === 'undefined') {
    setMapStatus('Map library failed to load. Route distance is still available.');
    return;
  }

  const mapEl = document.getElementById('resultsRouteMap');
  if (!mapEl || resultsMap) return;

  resultsMap = L.map(mapEl, {
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: false,
    preferCanvas: true
  }).setView([28.7041, 77.1025], 9);

  L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19,
    crossOrigin: true,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(resultsMap);

  resultsMarkerLayer = L.layerGroup().addTo(resultsMap);
  setTimeout(() => resultsMap.invalidateSize(true), 100);
  setTimeout(() => resultsMap.invalidateSize(true), 500);
}

async function loadResultsRouteMap() {
  if (!resultsMap) return;
  setMapStatus('Drawing road route…');

  try {
    const body = {
      from: fromCoords ? { ...fromCoords, name: from } : from,
      to: toCoords ? { ...toCoords, name: to } : to
    };

    const res = await fetch(`${API_BASE}/api/route/coords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!data.success || !data.data || !data.data.route) {
      throw new Error(data.message || 'Route not found');
    }

    drawResultsRoute(data.data.route);
  } catch (error) {
    console.warn('Results map route failed:', error);
    drawFallbackRoute();
    setMapStatus('Map route could not load. Distance result is still correct.');
  }
}

function drawResultsRoute(route) {
  if (!resultsMap || !route.fromCoords || !route.toCoords) return;

  if (resultsRouteLayer) {
    resultsMap.removeLayer(resultsRouteLayer);
    resultsRouteLayer = null;
  }
  if (resultsMarkerLayer) resultsMarkerLayer.clearLayers();

  const fromLatLng = [Number(route.fromCoords.lat), Number(route.fromCoords.lng)];
  const toLatLng = [Number(route.toCoords.lat), Number(route.toCoords.lng)];

  L.marker(fromLatLng).addTo(resultsMarkerLayer).bindPopup(`Pickup: ${escapeHtml(route.from || from)}`);
  L.marker(toLatLng).addTo(resultsMarkerLayer).bindPopup(`Drop: ${escapeHtml(route.to || to)}`);

  if (route.geometry && Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length) {
    const latLngs = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
    resultsRouteLayer = L.polyline(latLngs, { weight: 5, opacity: 0.9 }).addTo(resultsMap);
    resultsMap.fitBounds(resultsRouteLayer.getBounds(), { padding: [28, 28], maxZoom: 15 });
  } else {
    resultsRouteLayer = L.polyline([fromLatLng, toLatLng], { weight: 5, opacity: 0.75 }).addTo(resultsMap);
    resultsMap.fitBounds(L.latLngBounds([fromLatLng, toLatLng]), { padding: [28, 28], maxZoom: 15 });
  }

  if (route.distance) distance = Number(route.distance) || distance;
  if (route.durationMinutes) duration = Number(route.durationMinutes) || duration;
  updateMapSummary(distance, duration);

  setTimeout(() => resultsMap.invalidateSize(true), 150);
  setMapStatus('');
}

function drawFallbackRoute() {
  if (!resultsMap || !fromCoords || !toCoords) return;
  if (resultsMarkerLayer) resultsMarkerLayer.clearLayers();
  if (resultsRouteLayer) resultsMap.removeLayer(resultsRouteLayer);

  const fromLatLng = [fromCoords.lat, fromCoords.lng];
  const toLatLng = [toCoords.lat, toCoords.lng];
  L.marker(fromLatLng).addTo(resultsMarkerLayer).bindPopup(`Pickup: ${escapeHtml(from)}`);
  L.marker(toLatLng).addTo(resultsMarkerLayer).bindPopup(`Drop: ${escapeHtml(to)}`);
  resultsRouteLayer = L.polyline([fromLatLng, toLatLng], { weight: 5, opacity: 0.75, dashArray: '8 8' }).addTo(resultsMap);
  resultsMap.fitBounds(L.latLngBounds([fromLatLng, toLatLng]), { padding: [28, 28], maxZoom: 15 });
  setTimeout(() => resultsMap.invalidateSize(true), 150);
}

function updateMapSummary(km, mins) {
  const d = document.getElementById('mapDistanceText');
  const t = document.getElementById('mapDurationText');
  if (d) d.textContent = `${Number(km || 0).toFixed(1).replace(/\.0$/, '')} km`;
  if (t) t.textContent = mins ? `${Math.round(mins)} min` : '-- min';
}

function setMapStatus(message) {
  const el = document.getElementById('mapStatus');
  if (!el) return;
  if (!message) {
    el.classList.add('d-none');
    el.textContent = '';
  } else {
    el.textContent = message;
    el.classList.remove('d-none');
  }
}

async function bookRide(service, rideType, price, index) {
  if (!isLoggedIn()) {
    window.location.href = '/login';
    return;
  }

  const btn = document.getElementById(`bookBtn-${index}`);
  if (!btn || btn.disabled) return;

  btn.disabled = true;
  btn.innerHTML = `<span class="btn-spinner"></span> Booking...`;

  try {
    const response = await fetch(`${API_BASE}/api/bookings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ from, to, service, rideType, price, distance }),
    });

    const res = await response.json();

    if (res.success) {
      btn.innerHTML = `✓ Booked!`;
      btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
      showSuccessToast('Ride booked successfully!');
      setTimeout(() => { window.location.href = '/my-rides'; }, 1500);
    } else {
      btn.disabled = false;
      btn.innerHTML = `Book Now`;
      showErrorToast(res.message || 'Failed to book ride. Please try again.');
    }
  } catch (error) {
    console.error('Error booking ride:', error);
    btn.disabled = false;
    btn.innerHTML = `Book Now`;
    showErrorToast('Error booking ride. Please try again.');
  }
}

function showToast(message, type) {
  const existing = document.getElementById('toastMsg');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'toastMsg';
  el.textContent = message;
  const isError = type === 'error';
  Object.assign(el.style, {
    position: 'fixed', bottom: '32px', left: '50%',
    transform: 'translateX(-50%) translateY(10px)',
    background: isError ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
    border: `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
    color: isError ? '#fca5a5' : '#86efac',
    padding: '12px 28px', borderRadius: '50px',
    zIndex: '9999', fontSize: '0.875rem', fontWeight: '500',
    backdropFilter: 'blur(12px)',
    transition: 'opacity 0.3s, transform 0.3s',
    opacity: '0',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

const showSuccessToast = msg => showToast(msg, 'success');
const showErrorToast   = msg => showToast(msg, 'error');

// Legacy compat
function showSuccessMessage(message) { showSuccessToast(message); }