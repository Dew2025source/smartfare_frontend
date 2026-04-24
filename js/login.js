// Login page functionality

const API_BASE = 'https://smartfarebackend-production.up.railway.app';

document.addEventListener('DOMContentLoaded', function () {
  if (isLoggedIn()) {
    redirectAfterLogin();
    return;
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const submitBtn = document.getElementById('submitBtn');
  const originalBtnText = submitBtn.innerHTML;

  hideMessage();

  if (!email || !password) {
    showError('Please enter both email and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Logging in...';

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const res = await response.json();

    if (res.success) {
      saveAuth(res.data.token, res.data.user);
      showSuccess('Login successful! Redirecting...');
      setTimeout(redirectAfterLogin, 500);
    } else {
      showError(res.message || 'Invalid credentials. Please try again.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Network error. Please check your connection and try again.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}

function hideMessage() {
  const el = document.getElementById('errorMessage');
  if (el) el.classList.add('d-none');
}

function showError(message) {
  const el = document.getElementById('errorMessage');
  if (!el) return;
  el.textContent = message;
  el.className = 'alert-custom mb-3';
}

function showSuccess(message) {
  const el = document.getElementById('errorMessage');
  if (!el) return;
  el.textContent = message;
  el.className = 'alert-custom alert-success-custom mb-3';
}

function redirectAfterLogin() {
  const redirect = new URLSearchParams(window.location.search).get('redirect');
  window.location.href = redirect || '/';
}