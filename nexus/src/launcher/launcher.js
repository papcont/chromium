// Nexus App Launcher — launcher.js
// Reads apps.json and renders the app grid. Handles keyboard shortcuts
// and PLM status polling.

async function init() {
  const apps = await fetch('./apps.json').then((r) => r.json());

  renderGrid('cad-grid', apps.filter((a) => a.category === 'cad' || a.category === '3d-editor'));
  renderGrid('plm-grid', apps.filter((a) => a.category === 'plm' || a.category === 'ai'));

  setupKeyboardShortcuts(apps);
  checkNexusEnvironment();
  pollPLMStatus();
}

function renderGrid(containerId, apps) {
  const container = document.getElementById(containerId);
  apps.forEach((app, i) => {
    const card = document.createElement('a');
    card.className = 'app-card';
    card.href = app.url;
    card.setAttribute('aria-label', app.name);
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="app-icon">${app.icon}</div>
      <div class="app-name">${app.name}</div>
      <div class="app-desc">${app.description}</div>
      ${app.badge ? `<span class="app-badge">${app.badge}</span>` : ''}
    `;
    container.appendChild(card);
  });
}

function setupKeyboardShortcuts(apps) {
  document.addEventListener('keydown', (e) => {
    if (!e.altKey) return;
    const index = parseInt(e.key, 10) - 1;
    if (index >= 0 && index < apps.length) {
      e.preventDefault();
      window.location.href = apps[index].url;
    }
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      window.nexus?.plm?.openPanel();
    }
  });
}

function checkNexusEnvironment() {
  const versionEl = document.getElementById('nexus-version');
  if (window.nexus?.version) {
    versionEl.textContent = `Nexus ${window.nexus.version}`;
  } else {
    versionEl.textContent = 'Standard browser mode';
  }
}

async function pollPLMStatus() {
  const dot = document.getElementById('plm-dot');
  const label = document.getElementById('plm-status');

  if (!window.nexus?.plm) {
    dot.classList.add('offline');
    label.textContent = 'PLM panel not available (requires Nexus browser)';
    return;
  }

  try {
    await window.nexus.plm.getItem('ping');
    dot.classList.remove('offline');
    label.textContent = 'PLM connected';
  } catch {
    dot.classList.add('offline');
    label.textContent = 'PLM not connected — click to configure';
    label.style.cursor = 'pointer';
    label.onclick = () => window.nexus.plm.openPanel();
  }
}

init();
