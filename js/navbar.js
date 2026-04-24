document.addEventListener("DOMContentLoaded", function () {
  updateNavbar();
});

function updateNavbar() {
  const loggedIn = isLoggedIn();
  const user = getUser();

  const navLinks = document.getElementById("navLinks");
  const navButtons = document.getElementById("navButtons");

  if (!navLinks || !navButtons) return;

  if (loggedIn && user) {
    navLinks.innerHTML = `
      <li class="nav-item">
        <a class="nav-link" href="/">Home</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="/compare">Compare</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="/my-rides">My Rides</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="/contact">Contact</a>
      </li>
    `;

    navButtons.innerHTML = `
      <button class="btn btn-nav-outline btn-sm me-2" id="themeToggle" onclick="toggleTheme()">
        🌙 Dark
      </button>
      <span class="navbar-text nav-user-text me-3 d-none d-md-inline">
        ${user.name}
      </span>
      <button class="btn btn-nav-outline btn-sm" onclick="logout()">
        Logout
      </button>
    `;
  } else {
    navLinks.innerHTML = `
      <li class="nav-item">
        <a class="nav-link" href="/">Home</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="/compare">Compare</a>
      </li>
    `;

    navButtons.innerHTML = `
      <button class="btn btn-nav-outline btn-sm me-2" id="themeToggle" onclick="toggleTheme()">
        🌙 Dark
      </button>
      <a href="/login" class="btn btn-nav-outline btn-sm me-2">
        Login
      </a>
      <a href="/signup" class="btn btn-nav-primary btn-sm">
        Sign Up
      </a>
    `;
  }

  const currentPath = window.location.pathname;
  document.querySelectorAll(".nav-link").forEach((link) => {
    const linkPath = new URL(link.href).pathname;
    if (linkPath === currentPath) {
      link.classList.add("active");
    }
  });

  if (typeof applyTheme === "function") {
    applyTheme(localStorage.getItem("smartfare-theme") || "dark");
  }
}