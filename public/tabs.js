// ---------------------------------------------------------------------
// Onglets du tableau de bord : Accueil, Créer, Business, Boutique, Compte.
//
// Ce fichier ne change AUCUNE fonction : il décide seulement quelle carte
// est visible selon l'onglet choisi. Les cartes sont créées par les autres
// fichiers (app.js, quotes.js, boutique.js...) ; on les repère par leur
// identifiant, et un « observateur » gère celles qui arrivent plus tard.
//
// Chargé après dashboard.js et avant app.js (voir index.html).
// ---------------------------------------------------------------------
(function () {
  'use strict';

  var TABS = [
    { key: 'home', icon: '🏠', label: 'Accueil' },
    { key: 'create', icon: '✍️', label: 'Créer' },
    { key: 'business', icon: '💼', label: 'Business' },
    { key: 'shop', icon: '🛍️', label: 'Boutique' },
    { key: 'account', icon: '👤', label: 'Compte' },
  ];
  var STORAGE_KEY = 'sc_tab';

  // Élément -> onglet. Une entrée « tuile de » retrouve la tuile qui contient l'élément.
  var TILE_OF = {
    'tiktok-card': 'home',
    'btn-quick-create-script': 'home',
    'btn-refresh-radar': 'create',
    'personas-tile-list': 'create',
    'referral-content': 'account',
  };
  var CARD_OF = {
    'activity-tile': 'home',
    'storyboard-section': 'create',
    'persona-section': 'create',
    'replies-section': 'create',
    'contacts-section': 'business',
    'sponsorship-section': 'business',
    'quotes-section': 'business',
    'contracts-section': 'business',
    'boutique-section': 'shop',
    'subscription-section': 'account',
    'account-tile': 'account',
  };

  var current = 'home';
  var view = document.getElementById('view-dashboard');
  var grid = document.querySelector('.bento-grid');
  var tools = document.getElementById('extra-tools');
  var toolsHeader = document.querySelector('.extra-tools-header');
  var bottomNav = document.getElementById('bottom-nav');
  var mainPanel = document.querySelector('.main-panel');
  if (!view || !grid || !tools || !mainPanel) return;

  function readSaved() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return TABS.some(function (t) { return t.key === value; }) ? value : 'home';
    } catch (e) {
      return 'home';
    }
  }
  function save(key) {
    try { window.localStorage.setItem(STORAGE_KEY, key); } catch (e) { /* stockage indisponible */ }
  }

  // ---------- Barres d'onglets (haut sur ordinateur, bas sur téléphone) ----------

  function buttonsHtml() {
    return TABS.map(function (t) {
      return '<button type="button" data-tab="' + t.key + '"><span>' + t.icon + '</span>' + t.label + '</button>';
    }).join('');
  }

  var topBar = document.createElement('nav');
  topBar.id = 'app-tabs';
  topBar.className = 'app-tabs';
  topBar.setAttribute('aria-label', 'Sections');
  topBar.innerHTML = buttonsHtml();
  mainPanel.insertBefore(topBar, mainPanel.firstChild);

  if (bottomNav) bottomNav.innerHTML = buttonsHtml();

  function onBarClick(event) {
    var button = event.target.closest('button[data-tab]');
    if (!button) return;
    showTab(button.dataset.tab, true);
  }
  topBar.addEventListener('click', onBarClick);
  if (bottomNav) bottomNav.addEventListener('click', onBarClick);

  // ---------- Carte « Mon compte » (onglet Compte) ----------

  function ensureAccountTile() {
    if (document.getElementById('account-tile')) return;
    var tile = document.createElement('section');
    tile.id = 'account-tile';
    tile.className = 'bento-tile';
    tile.innerHTML =
      '<h3 class="bento-title">👤 Mon compte</h3>' +
      '<p class="muted" style="font-size:13px;margin-top:0;">Votre profil créateur, votre niche et vos informations personnelles.</p>' +
      '<button type="button" id="btn-account-profile" class="secondary" style="align-self:flex-start;">⚙️ Profil &amp; paramètres</button>';
    grid.appendChild(tile);
    tile.querySelector('#btn-account-profile').addEventListener('click', function () {
      var open = document.getElementById('btn-open-profile-nav');
      if (open) open.click();
    });
  }

  // ---------- Affichage ----------

  function tabOfNode(node) {
    if (!node || !node.id) return null;
    return CARD_OF[node.id] || null;
  }

  // Trouve, pour chaque tuile de la grille, l'onglet auquel elle appartient.
  function assignGrid() {
    Array.prototype.forEach.call(grid.children, function (tile) {
      var tab = tabOfNode(tile);
      if (!tab) {
        Object.keys(TILE_OF).some(function (id) {
          if (tile.querySelector('#' + id)) { tab = TILE_OF[id]; return true; }
          return false;
        });
      }
      tile.dataset.tabOwner = tab || 'home';
      if (tile.querySelector('#btn-refresh-radar')) tile.classList.add('tile-radar');
    });
    Array.prototype.forEach.call(tools.children, function (card) {
      card.dataset.tabOwner = tabOfNode(card) || 'create';
    });
  }

  function apply() {
    ensureAccountTile();
    assignGrid();
    document.body.setAttribute('data-active-tab', current);

    var visibleInGrid = 0;
    Array.prototype.forEach.call(grid.children, function (tile) {
      var show = tile.dataset.tabOwner === current;
      tile.classList.toggle('tab-off', !show);
      if (show) visibleInGrid += 1;
    });
    grid.classList.toggle('tab-off', visibleInGrid === 0);

    var visibleCards = [];
    Array.prototype.forEach.call(tools.children, function (card) {
      var show = card.dataset.tabOwner === current;
      card.classList.toggle('tab-off', !show);
      if (show) visibleCards.push(card);
    });
    tools.classList.toggle('tab-off', visibleCards.length === 0);
    if (toolsHeader) toolsHeader.classList.add('tab-off');

    // Un onglet qui ne montre qu'une seule carte : on l'ouvre directement.
    if (visibleCards.length === 1) expandCard(visibleCards[0]);

    Array.prototype.forEach.call(document.querySelectorAll('.app-tabs button[data-tab], .bottom-nav button[data-tab]'), function (button) {
      var on = button.dataset.tab === current;
      button.classList.toggle('active', on);
      if (on) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function expandCard(card) {
    if (!card.classList.contains('collapsed')) return;
    card.classList.remove('collapsed');
    var title = card.querySelector(':scope > h3');
    if (title) title.setAttribute('aria-expanded', 'true');
  }

  function showTab(key, scrollTop) {
    if (!TABS.some(function (t) { return t.key === key; })) key = 'home';
    current = key;
    save(key);
    apply();
    if (scrollTop) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // Ouvre l'onglet qui contient la carte demandée (utilisé par « Mon activité »).
  window.showTabFor = function (cardId) {
    var tab = CARD_OF[cardId];
    if (tab && tab !== current) showTab(tab, false);
  };
  window.showTab = showTab;

  // Petites pastilles rouges sur les onglets qui demandent une action.
  // badges = { shop: 3, business: 1 } (calculé par dashboard.js).
  window.refreshTabBadges = function (badges) {
    var counts = badges || {};
    ['shop', 'business'].forEach(function (key) {
      var n = Number(counts[key]) || 0;
      Array.prototype.forEach.call(document.querySelectorAll('button[data-tab="' + key + '"]'), function (button) {
        var pill = button.querySelector('.tab-badge');
        if (!n) {
          if (pill) pill.remove();
          return;
        }
        if (!pill) {
          pill = document.createElement('i');
          pill.className = 'tab-badge';
          pill.setAttribute('aria-hidden', 'true');
          button.appendChild(pill);
        }
        pill.textContent = n > 9 ? '9+' : String(n);
      });
    });
  };

  // ---------- En-tête : crédits + pastille de profil (menu déroulant) ----------
  // app.js écrit dans #nav un e-mail et deux boutons. On garde ces mêmes boutons
  // (leurs actions restent intactes) mais on les range dans un petit menu.
  var nav = document.getElementById('nav');

  function closeUserMenus() {
    Array.prototype.forEach.call(document.querySelectorAll('.user-panel'), function (panel) {
      panel.hidden = true;
      var avatar = panel.parentElement && panel.parentElement.querySelector('.user-avatar');
      if (avatar) avatar.setAttribute('aria-expanded', 'false');
    });
  }

  function enhanceNav() {
    if (!nav) return;
    var profileBtn = document.getElementById('btn-open-profile-nav');
    var logoutBtn = document.getElementById('btn-logout');
    if (!profileBtn || !logoutBtn || profileBtn.closest('.user-menu')) return;

    var emailEl = nav.querySelector('.nav-email');
    var email = emailEl ? emailEl.textContent.trim() : '';

    var wrap = document.createElement('div');
    wrap.className = 'user-menu';
    var avatar = document.createElement('button');
    avatar.type = 'button';
    avatar.className = 'user-avatar';
    avatar.setAttribute('aria-haspopup', 'true');
    avatar.setAttribute('aria-expanded', 'false');
    avatar.setAttribute('aria-label', 'Menu du compte');
    avatar.textContent = (email.charAt(0) || '?').toUpperCase();

    var panel = document.createElement('div');
    panel.className = 'user-panel';
    panel.hidden = true;
    var emailLine = document.createElement('div');
    emailLine.className = 'user-panel-email';
    emailLine.textContent = email;
    panel.appendChild(emailLine);
    panel.appendChild(profileBtn);
    panel.appendChild(logoutBtn);

    wrap.appendChild(avatar);
    wrap.appendChild(panel);
    if (emailEl) emailEl.remove();
    nav.appendChild(wrap);
    nav.classList.add('nav-compact');
    if (nav.parentElement) nav.parentElement.classList.add('header-compact');

    avatar.addEventListener('click', function (event) {
      event.stopPropagation();
      var willOpen = panel.hidden;
      closeUserMenus();
      panel.hidden = !willOpen;
      avatar.setAttribute('aria-expanded', String(willOpen));
    });
    panel.addEventListener('click', function (event) {
      event.stopPropagation();
      if (event.target.closest('button')) closeUserMenus();
    });
  }

  if (nav) {
    document.addEventListener('click', closeUserMenus);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeUserMenus();
    });
    new MutationObserver(enhanceNav).observe(nav, { childList: true });
    enhanceNav();
  }

  // Cartes ajoutées plus tard par les autres fichiers.
  var pending = false;
  function scheduleApply() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(function () {
      pending = false;
      apply();
    });
  }
  new MutationObserver(scheduleApply).observe(tools, { childList: true });
  new MutationObserver(scheduleApply).observe(grid, { childList: true });

  current = readSaved();
  apply();
})();
