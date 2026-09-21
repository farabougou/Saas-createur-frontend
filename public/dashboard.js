// ---------------------------------------------------------------------
// « Mon activité » : la vue d'ensemble de l'accueil. Elle ne demande rien de
// plus au serveur : elle relit ce que les autres cartes ont déjà chargé
// (devis, contrats, commandes de la boutique, sponsorings, contacts) et en
// tire deux choses : l'argent encaissé et ce qu'il reste à faire.
//
// Chargé APRÈS boutique.js et AVANT app.js (voir index.html). Les variables
// allQuotes, allContracts, shopOrders, allSponsorships et allContacts
// viennent des autres fichiers ; elles ne sont lues qu'au moment de
// l'affichage, donc l'ordre de chargement n'a pas d'importance.
// ---------------------------------------------------------------------

const ACTIVITY_PAID_ORDER = ['paye', 'expedie', 'livre'];

function activityIsThisMonth(iso) {
  if (!iso) return false;
  const date = new Date(iso);
  const now = new Date();
  return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function activityAdd(map, currency, minor) {
  const code = String(currency || 'XOF').toUpperCase();
  map[code] = (map[code] || 0) + (Number(minor) || 0);
}

// { XOF: 5000, EUR: 1200 } -> "5 000 F CFA + 12,00 €"
function activityMoneyText(map) {
  const parts = Object.keys(map)
    .filter((code) => map[code] > 0)
    .map((code) => formatQuoteAmount(map[code], code));
  return parts.length ? parts.join(' + ') : '0';
}

function computeActivity() {
  // typeof : ne plante pas si un fichier n'est pas (encore) chargé.
  const list = (value) => (Array.isArray(value) ? value : []);
  const quotes = list(typeof allQuotes !== 'undefined' ? allQuotes : []);
  const contracts = list(typeof allContracts !== 'undefined' ? allContracts : []);
  const orders = list(typeof shopOrders !== 'undefined' ? shopOrders : []);
  const sponsors = list(typeof allSponsorships !== 'undefined' ? allSponsorships : []);
  const contacts = list(typeof allContacts !== 'undefined' ? allContacts : []);

  const month = {};
  const total = {};
  const pending = {};

  quotes.forEach((q) => {
    if (q.status === 'payé') {
      activityAdd(total, q.currency, q.amount_cents);
      if (activityIsThisMonth(q.paid_at || q.updated_at || q.created_at)) activityAdd(month, q.currency, q.amount_cents);
    } else {
      activityAdd(pending, q.currency, q.amount_cents);
    }
  });
  orders.forEach((o) => {
    if (ACTIVITY_PAID_ORDER.includes(o.status)) {
      activityAdd(total, o.currency, o.total_minor);
      if (activityIsThisMonth(o.paid_at || o.created_at)) activityAdd(month, o.currency, o.total_minor);
    } else if (o.status === 'en_attente' || o.status === 'paiement_declare') {
      activityAdd(pending, o.currency, o.total_minor);
    }
  });

  const count = (list, predicate) => list.filter(predicate).length;
  const toVerify = count(orders, (o) => o.status === 'paiement_declare');
  const toShip = count(orders, (o) => o.status === 'paye' && o.product_kind === 'physique');
  const awaitingPay = count(orders, (o) => o.status === 'en_attente');
  const toSign = count(contracts, (c) => c.status === 'envoye');
  const unpaidQuotes = count(quotes, (q) => q.status !== 'payé');
  const negotiating = count(sponsors, (s) => s.status === 'en_negociation');
  const toContact = count(sponsors, (s) => s.status === 'a_contacter');

  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const todo = [];
  if (toVerify) todo.push({ icon: '💰', urgent: true, text: `${plural(toVerify, 'paiement à vérifier', 'paiements à vérifier')} dans la boutique`, target: 'boutique-section', orderFilter: 'paiement_declare' });
  if (toShip) todo.push({ icon: '📦', urgent: true, text: `${plural(toShip, 'commande payée à expédier', 'commandes payées à expédier')}`, target: 'boutique-section', orderFilter: 'paye' });
  if (toSign) todo.push({ icon: '✍️', text: `${plural(toSign, 'contrat en attente de signature', 'contrats en attente de signature')}`, target: 'contracts-section' });
  if (unpaidQuotes) todo.push({ icon: '🧾', text: `${plural(unpaidQuotes, 'devis en attente de paiement', 'devis en attente de paiement')}`, target: 'quotes-section' });
  if (awaitingPay) todo.push({ icon: '⏳', text: `${plural(awaitingPay, 'commande en attente de paiement du client', 'commandes en attente de paiement du client')}`, target: 'boutique-section', orderFilter: 'en_attente' });
  if (negotiating) todo.push({ icon: '🤝', text: `${plural(negotiating, 'marque en négociation', 'marques en négociation')}`, target: 'sponsorship-section' });
  if (toContact) todo.push({ icon: '📨', text: `${plural(toContact, 'marque à contacter', 'marques à contacter')}`, target: 'sponsorship-section' });

  return {
    month: activityMoneyText(month),
    total: activityMoneyText(total),
    pending: activityMoneyText(pending),
    todo,
    stats: {
      contacts: contacts.length,
      orders: orders.filter((o) => ACTIVITY_PAID_ORDER.includes(o.status)).length,
      signed: count(contracts, (c) => c.status === 'signe'),
      paidQuotes: count(quotes, (q) => q.status === 'payé'),
    },
  };
}

function ensureActivityTile() {
  if (document.getElementById('activity-tile')) return;
  const grid = document.querySelector('.bento-grid');
  if (!grid) return;

  const tile = document.createElement('section');
  tile.id = 'activity-tile';
  tile.className = 'bento-tile';
  // Sur toute la largeur de la grille, quelle que soit la taille de l'écran.
  tile.style.gridColumn = '1 / -1';
  tile.innerHTML = `
    <h3 class="bento-title">💼 Mon activité</h3>
    <div id="activity-body"><p class="muted" style="font-size:13px;">Chargement…</p></div>
  `;
  grid.insertBefore(tile, grid.firstChild);

  tile.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-activity-goto]');
    if (btn) activityGoto(btn.dataset.activityGoto, btn.dataset.activityFilter || '');
  });

  // Les autres cartes rechargent leurs données après chaque action
  // (confirmer un paiement, marquer un devis payé...) : on se remet à jour peu après.
  let timer = null;
  document.addEventListener('click', () => {
    clearTimeout(timer);
    timer = setTimeout(refreshActivityTile, 1500);
  });
}

// Ouvre la carte visée (repliée sur téléphone) et fait défiler jusqu'à elle.
function activityGoto(cardId, orderFilter) {
  // Affiche d'abord l'onglet qui contient la carte (voir tabs.js).
  if (typeof window.showTabFor === 'function') window.showTabFor(cardId);
  const card = document.getElementById(cardId);
  if (!card) return;

  card.classList.remove('collapsed');
  const title = card.querySelector(':scope > h3');
  if (title) title.setAttribute('aria-expanded', 'true');

  if (cardId === 'boutique-section') {
    const box = document.getElementById('shop-orders-box');
    if (box) box.open = true;
    const select = document.getElementById('shop-order-filter');
    if (select && orderFilter) {
      select.value = orderFilter;
      shopOrderFilter = orderFilter;
      renderShopOrders();
    }
  }
  window.requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function refreshActivityTile() {
  const body = document.getElementById('activity-body');
  if (!body) return;
  const a = computeActivity();

  const kpi = (label, value, color) => `
    <div style="padding:10px 12px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;">
      <div class="muted" style="font-size:12px;">${escapeHtml(label)}</div>
      <div style="font-weight:700;font-size:18px;margin-top:2px;${color ? `color:${color};` : ''}">${escapeHtml(value)}</div>
    </div>`;

  const rows = a.todo.length
    ? a.todo
        .map(
          (t) => `
        <button class="secondary" data-activity-goto="${t.target}" data-activity-filter="${t.orderFilter || ''}"
          style="display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;margin:0;${t.urgent ? 'border-color:rgba(234,179,8,0.55);' : ''}">
          <span>${t.icon} ${escapeHtml(t.text)}</span><span aria-hidden="true">→</span>
        </button>`
        )
        .join('')
    : '<p class="muted" style="font-size:13px;margin:4px 0 0;">Tout est à jour. 🎉 Partagez le lien de votre boutique ou envoyez un devis pour continuer à avancer.</p>';

  const stat = (icon, value, label) =>
    `<div style="text-align:center;"><div style="font-size:18px;font-weight:700;">${icon} ${value}</div><div class="muted" style="font-size:11px;">${escapeHtml(label)}</div></div>`;

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
      ${kpi('Encaissé ce mois-ci', a.month, '#86efac')}
      ${kpi('Encaissé au total', a.total)}
      ${kpi('En attente de paiement', a.pending, '#fde047')}
    </div>
    <div style="font-weight:600;margin:14px 0 6px;">À faire</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:6px;">${rows}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.12);">
      ${stat('👥', a.stats.contacts, 'contacts')}
      ${stat('🛍️', a.stats.orders, 'ventes boutique')}
      ${stat('🧾', a.stats.paidQuotes, 'devis payés')}
      ${stat('✍️', a.stats.signed, 'contrats signés')}
    </div>`;
}
