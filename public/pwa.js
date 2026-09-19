// Installation de l'application sur l'écran d'accueil (PWA) :
//  - enregistre le service worker ;
//  - sur téléphone, propose d'installer l'app (bouton natif sur Android,
//    mode d'emploi sur iPhone où Apple ne fournit pas de bouton).
(function () {
  'use strict';

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  // ---------- Bannière d'installation ----------
  var DISMISS_KEY = 'sc_install_dismissed_at';
  var DISMISS_DAYS = 30;

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function recentlyDismissed() {
    try {
      var at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return at && Date.now() - at < DISMISS_DAYS * 86400000;
    } catch (e) { return false; }
  }

  function rememberDismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
  }

  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferredPrompt = null;
  var banner = null;

  function buildBanner(mode) {
    var host = document.getElementById('view-dashboard');
    var main = host && host.querySelector('.main-panel');
    if (!main || banner) return;

    banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Installer l’application');

    var text = document.createElement('div');
    text.className = 'install-banner-text';
    var title = document.createElement('strong');
    title.textContent = 'Installez l’application';
    var sub = document.createElement('span');
    sub.textContent = mode === 'ios'
      ? 'Touchez « Partager » (le carré avec une flèche), puis « Sur l’écran d’accueil ».'
      : 'Ajoutez SaaS Créateurs à votre écran d’accueil pour l’ouvrir comme une vraie application.';
    text.appendChild(title);
    text.appendChild(sub);
    banner.appendChild(text);

    if (mode === 'android') {
      var install = document.createElement('button');
      install.type = 'button';
      install.className = 'install-banner-btn';
      install.textContent = 'Installer';
      install.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          removeBanner();
        }).catch(function () {});
      });
      banner.appendChild(install);
    }

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'install-banner-close';
    close.setAttribute('aria-label', 'Masquer');
    close.textContent = '✕';
    close.addEventListener('click', function () {
      rememberDismiss();
      removeBanner();
    });
    banner.appendChild(close);

    main.insertBefore(banner, main.firstChild);
  }

  function removeBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone() && !recentlyDismissed()) buildBanner('android');
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    removeBanner();
  });

  if (isIos && !isStandalone() && !recentlyDismissed()) {
    // Le tableau de bord est construit par app.js : on attend qu'il existe.
    window.addEventListener('load', function () { buildBanner('ios'); });
  }
})();
