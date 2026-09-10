/*
 * Shared chrome for the static demo.
 *
 * Every page ships only its own <main>; the sidebar, the mode rail and the
 * mode switcher are rendered here so the nine pages cannot drift apart. In the
 * real app this is `views/partials/app-shell-open.ejs`.
 *
 * The demo also uses this file to make the two modes inspectable:
 *
 *   - `?modo=aprendo` / `?modo=enseno` overrides the page's default mode on
 *     pages that exist in both (the library, the create screen).
 *   - `data-copy-aprendo` / `data-copy-enseno` swap an element's text.
 *   - `.only-aprendo` / `.only-enseno` show or hide a whole block.
 *
 * Those three mechanisms are exactly the ones the README asks the real
 * implementation to use, so this file doubles as the reference for them.
 */

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>',
  chat: '<path d="M20 4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3v4l4.5-4H20a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Z"/>',
  library: '<path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H10l2 2.5h6.5A1.5 1.5 0 0 1 20 9v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/>',
  progress: '<path d="M4 19h16"/><path d="M7 19v-6"/><path d="M12 19V7"/><path d="M17 19v-9"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  translate: '<path d="M4 6h11"/><path d="M9 4v2c0 4-2.2 7.5-5 9"/><path d="M7 12c1.3 2.3 3.3 4 6 5"/><path d="m12.5 20 4-9 4 9"/><path d="M14 17h5.5"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3 2.9-4.5 5.5-4.5S14 16 14.6 19"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M17.5 14.8c1.7.6 2.8 2 3.2 4.2"/>',
  report: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  swatch: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};

const NAV = {
  aprendo: [
    { label: 'Mi práctica', href: 'aprendo-inicio.html', icon: 'home', view: 'inicio' },
    { label: 'Hablar con Mr. F', href: '#', icon: 'chat', view: 'charla', count: '3' },
    { label: 'Mi biblioteca', href: 'aprendo-biblioteca.html', icon: 'library', view: 'biblioteca', count: '12' },
    { label: 'Mi progreso', href: 'aprendo-progreso.html', icon: 'progress', view: 'progreso' },
    { label: 'Traductor', href: '#', icon: 'translate', view: 'traductor' },
  ],
  enseno: [
    { label: 'Panel de clase', href: 'enseno-inicio.html', icon: 'home', view: 'inicio' },
    { label: 'Grupos y entregas', href: 'enseno-clase.html', icon: 'people', view: 'clase', count: '2' },
    { label: 'Materiales', href: 'aprendo-biblioteca.html?modo=enseno', icon: 'library', view: 'biblioteca', count: '12' },
    { label: 'Informes', href: '#', icon: 'report', view: 'informes' },
  ],
};

const WHO = {
  aprendo: { initials: 'MC', name: 'María C.', role: 'Estudiante · A2' },
  enseno: { initials: 'QF', name: 'Fabiola R.', role: 'Profesora · 2 grupos' },
};

function icon(name, className) {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

function currentMode() {
  const requested = new URLSearchParams(window.location.search).get('modo');
  if (requested === 'aprendo' || requested === 'enseno') {
    return requested;
  }
  return document.body.dataset.mode === 'enseno' ? 'enseno' : 'aprendo';
}

function modeSwitchHref(mode, isLocalToggle) {
  if (isLocalToggle) {
    return `${window.location.pathname.split('/').pop()}?modo=${mode}`;
  }
  return mode === 'enseno' ? 'enseno-inicio.html' : 'aprendo-inicio.html';
}

function renderSidebar(mode, view) {
  const isLocalToggle = document.body.dataset.modeToggle === 'local';
  const links = NAV[mode]
    .map((item) => {
      const active = item.view === view ? ' aria-current="page"' : '';
      const count = item.count ? `<span class="nav-count">${item.count}</span>` : '';
      return `<a class="nav-link" href="${item.href}"${active}>${icon(item.icon, 'nav-icon')}<span>${item.label}</span>${count}</a>`;
    })
    .join('');

  const who = WHO[mode];

  return `
    <div class="shell-rail" aria-hidden="true"></div>
    <aside class="sidebar">
      <a class="brand" href="index.html">
        <span class="brand-mark">F</span>
        <span>Mister F</span>
      </a>

      <nav class="mode-switch" aria-label="Modo">
        <a href="${modeSwitchHref('aprendo', isLocalToggle)}"${mode === 'aprendo' ? ' aria-current="true"' : ''}>Aprendo</a>
        <a href="${modeSwitchHref('enseno', isLocalToggle)}"${mode === 'enseno' ? ' aria-current="true"' : ''}>Enseño</a>
      </nav>
      <p class="mode-hint">${
        mode === 'aprendo'
          ? 'Estás practicando. Mr. F te corrige y guarda lo que te cuesta.'
          : 'Estás preparando clase. Ves entregas, no ejercicios.'
      }</p>

      <div class="nav-group">${links}</div>

      <div class="nav-group">
        <p class="nav-label">${mode === 'aprendo' ? 'Recientes' : 'Grupos'}</p>
        ${
          mode === 'aprendo'
            ? `
          <a class="nav-link" href="#"><span class="nav-dot" style="color: var(--fam-charla)"></span><span>Pedir cita en la clínica</span></a>
          <a class="nav-link" href="#"><span class="nav-dot" style="color: var(--fam-quiz)"></span><span>Past simple — Worksheet 7B</span></a>
          <a class="nav-link" href="#"><span class="nav-dot" style="color: var(--fam-roleplay)"></span><span>En el supermercado</span></a>`
            : `
          <a class="nav-link" href="enseno-clase.html"><span class="nav-dot" style="color: var(--navy)"></span><span>Martes 7pm — A2</span><span class="nav-count">9</span></a>
          <a class="nav-link" href="#"><span class="nav-dot" style="color: var(--fam-roleplay)"></span><span>Sábado 10am — B1</span><span class="nav-count">6</span></a>`
        }
      </div>

      <div class="sidebar-bottom">
        <a class="who" href="#">
          <span class="who-avatar">${who.initials}</span>
          <span class="who-copy">
            <span class="who-name">${who.name}</span>
            <span class="who-role">${who.role}</span>
          </span>
        </a>
      </div>
    </aside>
  `;
}

function applyModeCopy(mode) {
  document.querySelectorAll('[data-copy-aprendo][data-copy-enseno]').forEach((element) => {
    element.textContent = element.dataset[mode === 'enseno' ? 'copyEnseno' : 'copyAprendo'];
  });
  document.querySelectorAll('.only-aprendo').forEach((element) => {
    element.hidden = mode !== 'aprendo';
  });
  document.querySelectorAll('.only-enseno').forEach((element) => {
    element.hidden = mode !== 'enseno';
  });
}

function mount() {
  const mode = currentMode();
  document.documentElement.dataset.mode = mode;

  const shell = document.querySelector('.shell');
  if (shell) {
    shell.insertAdjacentHTML('afterbegin', renderSidebar(mode, document.body.dataset.view || ''));
  }

  applyModeCopy(mode);
}

mount();
