// Comportements propres aux téléphones : sections d'outils repliables et
// barre de navigation fixe en bas de l'écran. Sur ordinateur, rien ne change.
(function () {
  'use strict';

  var mq = window.matchMedia('(max-width: 640px)');
  var tools = document.getElementById('extra-tools');
  var nav = document.getElementById('bottom-nav');

  // ---------- Sections d'outils repliables (téléphone uniquement) ----------

  function titleOf(card) {
    return card.querySelector(':scope > h3');
  }

  function setCollapsed(card, collapsed) {
    var title = titleOf(card);
    card.classList.toggle('collapsed', collapsed);
    if (title) title.setAttribute('aria-expanded', String(!collapsed));
  }

  // Met une carte dans le bon mode : repliée avec un titre cliquable sur
  // téléphone, dépliée et inchangée sur ordinateur.
  function applyMode(card) {
    var title = titleOf(card);
    if (!title) return;
    if (mq.matches) {
      title.setAttribute('role', 'button');
      title.setAttribute('tabindex', '0');
      setCollapsed(card, true);
    } else {
      title.removeAttribute('role');
      title.removeAttribute('tabindex');
      title.removeAttribute('aria-expanded');
      card.classList.remove('collapsed');
    }
  }

  // Prépare les cartes présentes ou ajoutées plus tard par app.js / quotes.js.
  function prepareAll() {
    if (!tools) return;
    Array.prototype.forEach.call(tools.children, function (card) {
      if (card.dataset.collapsibleReady || !titleOf(card)) return;
      card.dataset.collapsibleReady = '1';
      card.classList.add('collapsible');
      applyMode(card);
    });
  }

  function toggleFromTitle(title) {
    var card = title.parentElement;
    if (!mq.matches || !card.classList.contains('collapsible')) return;
    setCollapsed(card, !card.classList.contains('collapsed'));
  }

  if (tools) {
    prepareAll();
    new MutationObserver(prepareAll).observe(tools, { childList: true, subtree: true });

    tools.addEventListener('click', function (event) {
      var title = event.target.closest('.collapsible > h3');
      if (title && tools.contains(title)) toggleFromTitle(title);
    });
    tools.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var title = event.target.closest('.collapsible > h3');
      if (title && tools.contains(title)) {
        event.preventDefault();
        toggleFromTitle(title);
      }
    });
  }

  // Passage téléphone <-> ordinateur (rotation, fenêtre redimensionnée).
  function onModeChange() {
    if (!tools) return;
    Array.prototype.forEach.call(tools.querySelectorAll('.collapsible'), applyMode);
  }
  if (mq.addEventListener) mq.addEventListener('change', onModeChange);
  else if (mq.addListener) mq.addListener(onModeChange);

  // ---------- Barre de navigation du bas ----------

  function scrollToElement(el) {
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openCard(id) {
    var card = document.getElementById(id);
    if (!card) return;
    if (card.classList.contains('collapsible')) setCollapsed(card, false);
    window.requestAnimationFrame(function () {
      scrollToElement(card);
    });
  }

  if (nav) {
    nav.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-nav]');
      if (!button) return;
      var target;
      switch (button.dataset.nav) {
        case 'top':
          window.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        case 'create':
          target = document.getElementById('btn-quick-create-script');
          if (target) target.click();
          break;
        case 'tools':
          scrollToElement(document.querySelector('.extra-tools-header'));
          break;
        case 'quotes':
          openCard('quotes-section');
          break;
        case 'account':
          target = document.getElementById('btn-open-profile-nav');
          if (target) target.click();
          break;
      }
    });
  }
})();
