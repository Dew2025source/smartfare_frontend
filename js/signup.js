// Signup page functionality

const API_BASE = 'https://smartfarebackend-production.up.railway.app';

document.addEventListener('DOMContentLoaded', function () {
  if (isLoggedIn()) {
    window.location.href = '/';
    return;
  }

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }
});

async function handleSignup(e) {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const submitBtn = document.getElementById('submitBtn');
  const originalBtnText = submitBtn.innerHTML;

  hideMessage();

  if (!name || !email || !password || !confirmPassword) {
    showError('Please fill in all fields.');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters long.');
    return;
  }

  if (password !== confirmPassword) {
    showError('Passwords do not match.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Creating account...';

  try {
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const res = await response.json();

    if (res.success) {
      saveAuth(res.data.token, res.data.user);
      showSuccess('Account created successfully! Redirecting...');
      setTimeout(() => { window.location.href = '/'; }, 500);
    } else {
      showError(res.message || 'Failed to create account. Please try again.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  } catch (error) {
    console.error('Signup error:', error);
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
