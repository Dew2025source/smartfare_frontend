// Authentication utility functions

const AUTH_TOKEN_KEY = 'rf_token';
const AUTH_USER_KEY = 'rf_user';

// Get stored token
function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Get stored user
function getUser() {
  const userStr = localStorage.getItem(AUTH_USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

// Save auth data
function saveAuth(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

// Clear auth data
function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

// Check if user is logged in
function isLoggedIn() {
  return !!getToken();
}

// Logout
function logout() {
  // Show confirmation modal instead of instant logout
  const modal = new bootstrap.Modal(document.getElementById('logoutModal'));
  modal.show();
}
function confirmLogout() {
  // Hide modal then actually log out
  const modalEl = document.getElementById('logoutModal');
  bootstrap.Modal.getInstance(modalEl).hide();
  session.clear();
  updateNav();
  showToast('Logged out. See you soon! 👋', 'info');
  navigate('home');
}

// Redirect if not authenticated
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
  }
}

// Get auth header for API requests
function getAuthHeader() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
