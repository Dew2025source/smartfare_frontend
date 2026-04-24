const API_BASE = "https://smartfarebackend-production.up.railway.app";
let bookings = [];
let pendingDeleteId = null;
let isDeleting = false;

document.addEventListener('DOMContentLoaded', function () {
  requireAuth();
  loadBookings();
  setupDeleteModal();
});

// ── Modal ──────────────────────────────────────────────────────────────────────

function setupDeleteModal() {
  const modal       = document.getElementById('deleteModal');
  const confirmBtn  = document.getElementById('confirmDeleteBtn');
  const cancelBtns  = modal.querySelectorAll('[data-dismiss="deleteModal"]');

  confirmBtn.addEventListener('click', async function () {
    if (!pendingDeleteId || isDeleting) return;
    await performDelete(pendingDeleteId);
  });

  cancelBtns.forEach(btn => btn.addEventListener('click', closeDeleteModal));

  modal.querySelector('.modal-backdrop-custom')
    ?.addEventListener('click', closeDeleteModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDeleteModal();
  });
}

function showDeleteModal(bookingId) {
  if (isDeleting) return;
  pendingDeleteId = bookingId;
  const modal = document.getElementById('deleteModal');
  modal.classList.add('show');
  document.getElementById('confirmDeleteBtn').disabled = false;
  document.getElementById('confirmDeleteBtn').textContent = 'Delete Ride';
  document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
  if (isDeleting) return;
  const modal = document.getElementById('deleteModal');
  modal.classList.remove('show');
  pendingDeleteId = null;
  document.body.style.overflow = '';
}

// ── Load & display ─────────────────────────────────────────────────────────────

async function loadBookings() {
  const container = document.getElementById('bookingsContainer');

  container.innerHTML = `
    <div class="text-center py-5 fade-in">
      <div class="loading-spinner mb-3"></div>
      <p style="color:var(--text-muted); font-size:0.875rem; margin-top:8px;">Loading your rides…</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE}/api/bookings/my`, {
      headers: { ...getAuthHeader() },
    });
    const res = await response.json();
    if (res.success) {
      bookings = res.data.bookings;
      displayBookings();
    } else {
      throw new Error(res.message || 'Failed to load bookings');
    }
  } catch (err) {
    console.error('Error loading bookings:', err);
    container.innerHTML = `
      <div class="alert-custom text-center py-4 fade-in">
        <span style="font-size:1.8rem; display:block; margin-bottom:10px;">⚠️</span>
        <p style="margin:0; font-size:0.9rem;">Failed to load bookings. Please try again.</p>
      </div>
    `;
  }
}

function displayBookings() {
  const container = document.getElementById('bookingsContainer');

  if (bookings.length === 0) {
    updateStats(0, 0, 0);
    container.innerHTML = `
      <div class="text-center py-5 fade-in">
        <div class="mb-3" style="font-size:3.5rem; opacity:0.2;">🚗</div>
        <h5 class="fw-semibold mb-2">No rides booked yet</h5>
        <p style="color:var(--text-muted); font-size:0.875rem;" class="mb-4">
          Compare fares and book your first ride!
        </p>
        <a href="/compare" class="btn btn-primary-custom">Compare Fares Now</a>
      </div>
    `;
    return;
  }

  const totalAmount   = bookings.reduce((s, b) => s + b.price, 0);
  const totalDistance = bookings.reduce((s, b) => s + b.distance, 0);
  updateStats(bookings.length, totalAmount, totalDistance);

  const SERVICE_ICONS = { Ola: '🟢', Uber: '⬛', Rapido: '🟡' };

  container.innerHTML = bookings.map((booking, i) => {
    const date          = new Date(booking.createdAt || booking.date);
    const formattedDate = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const icon          = SERVICE_ICONS[booking.service] || '🚗';

    return `
      <div class="ride-card card-custom fade-in" style="animation-delay:${i * 0.06}s;">
        <div class="d-flex align-items-start gap-3">

          <div class="service-icon" style="flex-shrink:0; font-size:1.6rem; line-height:1;">${icon}</div>

          <div class="flex-grow-1" style="min-width:0;">
            <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
              <h6 class="mb-0 fw-bold" style="font-size:0.95rem;">${booking.service}</h6>
              <span class="ride-type-badge">${booking.rideType}</span>
            </div>
            <div class="d-flex align-items-center gap-1 flex-wrap mb-1" style="font-size:0.82rem; color:var(--text-muted);">
              <span class="text-truncate fw-medium" style="max-width:120px;">${booking.from}</span>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;">
                <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="text-truncate" style="max-width:120px;">${booking.to}</span>
              <span class="opacity-50 mx-1">•</span>
              <span style="flex-shrink:0;">${booking.distance} km</span>
            </div>
            <div style="font-size:0.76rem; color:var(--text-muted);">${formattedDate} at ${formattedTime}</div>
          </div>

          <div class="d-flex flex-column align-items-end gap-2" style="flex-shrink:0;">
            <div class="price-tag" style="font-size:1.35rem; font-weight:700;">₹${booking.price}</div>
            <button
              class="delete-btn"
              onclick="showDeleteModal('${booking._id}')"
              aria-label="Delete booking"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Delete
            </button>
          </div>

        </div>
      </div>
    `;
  }).join('');
}

function updateStats(total, amount, distance) {
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set('statsTotal',    total);
  set('statsAmount',   `₹${amount}`);
  set('statsDistance', `${distance} km`);
}

// ── Delete ─────────────────────────────────────────────────────────────────────

async function performDelete(bookingId) {
  isDeleting = true;

  const confirmBtn = document.getElementById('confirmDeleteBtn');
  confirmBtn.disabled    = true;
  confirmBtn.textContent = 'Deleting…';

  try {
    const response = await fetch(`${API_BASE}/api/bookings/${bookingId}`, {
      method:  'DELETE',
      headers: { ...getAuthHeader() },
    });
    const res = await response.json();

    if (res.success) {
      closeDeleteModal();
      document.body.style.overflow = '';

      const card = document.querySelector(`[onclick="showDeleteModal('${bookingId}')"]`)
        ?.closest('.ride-card');
      if (card) {
        card.style.transition = 'opacity 0.3s, transform 0.3s, max-height 0.35s';
        card.style.opacity    = '0';
        card.style.transform  = 'translateX(24px)';
        await new Promise(r => setTimeout(r, 320));
      }

      bookings = bookings.filter(b => b._id !== bookingId);
      displayBookings();
      showToast('Ride deleted successfully ✓', 'success');
    } else {
      throw new Error(res.message || 'Delete failed');
    }
  } catch (err) {
    console.error('Error deleting booking:', err);
    showToast(err.message || 'Error deleting booking. Please try again.', 'error');
    confirmBtn.disabled    = false;
    confirmBtn.textContent = 'Delete Ride';
  } finally {
    isDeleting     = false;
    pendingDeleteId = null;
  }
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const existing = document.getElementById('toastMsg');
  if (existing) existing.remove();

  const el  = document.createElement('div');
  el.id     = 'toastMsg';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = message;

  const isErr = type === 'error';
  Object.assign(el.style, {
    position:       'fixed',
    bottom:         '32px',
    left:           '50%',
    transform:      'translateX(-50%) translateY(12px)',
    background:     isErr ? 'rgba(239,68,68,0.13)' : 'rgba(34,197,94,0.13)',
    border:         `1px solid ${isErr ? 'rgba(239,68,68,0.28)' : 'rgba(34,197,94,0.28)'}`,
    color:          isErr ? '#fca5a5' : '#86efac',
    padding:        '11px 24px',
    borderRadius:   '50px',
    zIndex:         '10000',
    fontSize:       '0.875rem',
    fontWeight:     '500',
    backdropFilter: 'blur(14px)',
    transition:     'opacity 0.28s, transform 0.28s',
    opacity:        '0',
    whiteSpace:     'nowrap',
  });

  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity   = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity   = '0';
    el.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}