// ---------------------------------------------------------------------
// Boutique Mobile Money : le créateur vend des produits numériques et
// physiques ; ses clients paient par Orange Money, Moov Money ou Wave et il
// confirme le paiement d'un clic. Les clients passent par les pages
// publiques boutique.html (vitrine) et commande.html (suivi et paiement).
//
// Chargé AVANT app.js (voir index.html). Comme contracts.js, il utilise des
// éléments définis ailleurs (el, authHeadersOrNull, API_BASE_URL,
// showMessage, clearMessage, escapeHtml, friendlyErrorMessage dans app.js ;
// phoneToWhatsappNumber, formatQuoteAmount, parseAmountToMinor dans
// quotes.js) : ils ne sont utilisés qu'au moment où l'utilisateur clique ou
// quand le tableau de bord se charge, une fois tous les fichiers chargés.
// ---------------------------------------------------------------------

let shopInfo = null;
let shopProducts = [];
let shopOrders = [];
let editingProductId = null;
let shopOrderFilter = 'all';
let shopSlugTouched = false;

const SHOP_OPERATOR_LABELS = { orange: 'Orange Money', moov: 'Moov Money', wave: 'Wave' };

const SHOP_ORDER_STATUS = {
  en_attente: { label: 'En attente de paiement', bg: 'rgba(148,163,184,0.18)', color: '#cbd5e1' },
  paiement_declare: { label: 'Paiement à vérifier', bg: 'rgba(234,179,8,0.18)', color: '#fde047' },
  paye: { label: 'Payée', bg: 'rgba(34,197,94,0.18)', color: '#86efac' },
  expedie: { label: 'Expédiée', bg: 'rgba(59,130,246,0.18)', color: '#93c5fd' },
  livre: { label: 'Livrée', bg: 'rgba(34,197,94,0.18)', color: '#86efac' },
  annule: { label: 'Annulée', bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
};

function shopOrderBadge(status) {
  const s = SHOP_ORDER_STATUS[status] || SHOP_ORDER_STATUS.en_attente;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${s.bg};color:${s.color};">${escapeHtml(s.label)}</span>`;
}

function shopReference(order) {
  return `CMD-${String(order.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

// "Ma Boutique Été !" -> "ma-boutique-ete"
function shopSlugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function ensureBoutiqueUI() {
  if (document.getElementById('boutique-section')) return; // déjà injecté

  const section = document.createElement('div');
  section.id = 'boutique-section';
  section.className = 'card';
  section.style.marginTop = '20px';
  section.innerHTML = `
    <h3 style="margin-top:0;">🛍️ Boutique</h3>
    <p class="muted" style="margin-top:0;">
      Vendez vos produits numériques et physiques. Vos clients paient par Orange Money, Moov Money ou Wave,
      puis vous confirmez le paiement d'un clic : le fichier est alors débloqué pour eux.
    </p>
    <div id="boutique-message"></div>
    <div id="shop-link-box" class="hidden" style="margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;"></div>

    <details id="shop-settings-box" style="margin-top:12px;">
      <summary style="cursor:pointer;font-weight:600;">⚙️ Réglages de la boutique</summary>
      <div style="margin-top:8px;">
        <label for="shop-name">Nom de la boutique</label>
        <input id="shop-name" maxlength="80" placeholder="Ex : KOFA Shop" />
        <label for="shop-slug">Adresse de la boutique</label>
        <input id="shop-slug" maxlength="40" placeholder="kofa-shop" autocapitalize="none" autocomplete="off" />
        <div id="shop-slug-preview" class="muted" style="font-size:12px;margin-top:4px;"></div>
        <label for="shop-currency">Devise</label>
        <select id="shop-currency">
          <option value="XOF">Franc CFA (F CFA)</option>
          <option value="EUR">Euro (€)</option>
        </select>
        <label for="shop-desc">Présentation (facultatif)</label>
        <textarea id="shop-desc" rows="2" maxlength="1000" placeholder="Ex : Mes guides et accessoires pour créateurs."></textarea>
        <label for="shop-whatsapp">Votre numéro WhatsApp (pour être contacté par vos clients)</label>
        <input id="shop-whatsapp" type="tel" maxlength="40" placeholder="+223 70 00 00 00" />
        <div style="margin-top:10px;font-weight:600;">Où vos clients doivent-ils vous payer ?</div>
        <label for="shop-orange">Numéro Orange Money</label>
        <input id="shop-orange" type="tel" maxlength="40" placeholder="Ex : 76 12 34 56" />
        <label for="shop-moov">Numéro Moov Money</label>
        <input id="shop-moov" type="tel" maxlength="40" placeholder="Ex : 66 12 34 56" />
        <label for="shop-wave">Numéro Wave</label>
        <input id="shop-wave" type="tel" maxlength="40" placeholder="Ex : 70 12 34 56" />
        <label for="shop-note">Message affiché au moment du paiement (facultatif)</label>
        <textarea id="shop-note" rows="2" maxlength="500" placeholder="Ex : Envoyez le montant exact et gardez le SMS de confirmation."></textarea>
        <label style="display:flex;gap:8px;align-items:center;margin-top:12px;color:var(--text);">
          <input id="shop-active" type="checkbox" style="width:auto;" /> Boutique ouverte au public
        </label>
        <div style="margin-top:10px;"><button id="btn-save-shop">Enregistrer la boutique</button></div>
      </div>
    </details>

    <details id="shop-products-box" style="margin-top:14px;">
      <summary id="shop-products-summary" style="cursor:pointer;font-weight:600;">📦 Produits</summary>
      <div style="margin-top:8px;">
        <button id="btn-new-product">+ Nouveau produit</button>
        <div id="product-form" class="hidden" style="margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;">
          <div id="product-form-title" style="font-weight:600;margin-bottom:8px;">Nouveau produit</div>
          <label for="product-kind">Type de produit</label>
          <select id="product-kind">
            <option value="numerique">Produit numérique (fichier à télécharger)</option>
            <option value="physique">Produit physique (à livrer)</option>
          </select>
          <label for="product-name">Nom du produit</label>
          <input id="product-name" maxlength="120" placeholder="Ex : Guide TikTok pour débutants" />
          <label for="product-desc">Description (facultatif)</label>
          <textarea id="product-desc" rows="3" maxlength="3000"></textarea>
          <label for="product-price" id="product-price-label">Prix</label>
          <input id="product-price" inputmode="decimal" placeholder="Ex : 5000" />
          <div id="product-digital-box">
            <label for="product-digital">Lien de téléchargement (Google Drive, Dropbox…)</label>
            <input id="product-digital" maxlength="1000" placeholder="https://" autocapitalize="none" />
            <div class="muted" style="font-size:12px;margin-top:4px;">Ce lien n'est montré au client qu'après votre confirmation du paiement.</div>
          </div>
          <div id="product-stock-box" class="hidden">
            <label for="product-stock">Stock disponible (laissez vide pour un stock illimité)</label>
            <input id="product-stock" inputmode="numeric" placeholder="Ex : 10" />
          </div>
          <label for="product-image">Adresse d'une photo (facultatif)</label>
          <input id="product-image" maxlength="1000" placeholder="https://" autocapitalize="none" />
          <div class="muted" style="font-size:12px;margin-top:4px;">L'envoi de photos depuis votre téléphone arrive bientôt.</div>
          <label style="display:flex;gap:8px;align-items:center;margin-top:12px;color:var(--text);">
            <input id="product-active" type="checkbox" style="width:auto;" checked /> Visible dans la boutique
          </label>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button id="btn-save-product">Ajouter</button>
            <button class="secondary" id="btn-cancel-product">Annuler</button>
          </div>
        </div>
        <div id="shop-products-list" style="margin-top:8px;"></div>
      </div>
    </details>

    <details id="shop-orders-box" open style="margin-top:14px;">
      <summary id="shop-orders-summary" style="cursor:pointer;font-weight:600;">🧾 Commandes</summary>
      <div style="margin-top:8px;">
        <select id="shop-order-filter">
          <option value="all">Toutes les commandes</option>
          <option value="paiement_declare">Paiement à vérifier</option>
          <option value="en_attente">En attente de paiement</option>
          <option value="paye">Payées, à livrer</option>
          <option value="livre">Livrées</option>
          <option value="annule">Annulées</option>
        </select>
        <div id="shop-orders-list" style="margin-top:8px;"></div>
      </div>
    </details>
  `;

  el.extraTools.appendChild(section);

  document.getElementById('btn-save-shop').addEventListener('click', saveShop);
  document.getElementById('shop-name').addEventListener('input', () => {
    if (!shopInfo && !shopSlugTouched) document.getElementById('shop-slug').value = shopSlugify(document.getElementById('shop-name').value);
    updateShopUrlPreview();
  });
  document.getElementById('shop-slug').addEventListener('input', () => {
    shopSlugTouched = true;
    updateShopUrlPreview();
  });
  document.getElementById('btn-new-product').addEventListener('click', () => openProductForm(null));
  document.getElementById('btn-cancel-product').addEventListener('click', closeProductForm);
  document.getElementById('btn-save-product').addEventListener('click', saveProduct);
  document.getElementById('product-kind').addEventListener('change', refreshProductFormKind);
  document.getElementById('shop-order-filter').addEventListener('change', (event) => {
    shopOrderFilter = event.target.value;
    renderShopOrders();
  });

  document.getElementById('shop-link-box').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-shop-action]');
    if (!btn || !shopInfo) return;
    if (btn.dataset.shopAction === 'copy') copyShopLink();
    if (btn.dataset.shopAction === 'share') window.open(`https://wa.me/?text=${encodeURIComponent(`Découvrez ma boutique : ${shopInfo.shop_url}`)}`, '_blank', 'noopener');
  });

  document.getElementById('shop-products-list').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-product-action]');
    if (!btn) return;
    const product = shopProducts.find((p) => String(p.id) === btn.dataset.productId);
    if (!product) return;
    const action = btn.dataset.productAction;
    if (action === 'edit') openProductForm(product);
    if (action === 'toggle') toggleProductActive(product, btn);
    if (action === 'delete') deleteProduct(product, btn);
  });

  document.getElementById('shop-orders-list').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-order-action]');
    if (!btn) return;
    const order = shopOrders.find((o) => String(o.id) === btn.dataset.orderId);
    if (!order) return;
    const action = btn.dataset.orderAction;
    if (action === 'whatsapp') return openOrderWhatsapp(order);
    runOrderAction(order, action, btn);
  });
}

function shopCurrency() {
  return (shopInfo && shopInfo.currency) || document.getElementById('shop-currency').value || 'XOF';
}

function updateShopUrlPreview() {
  const slug = document.getElementById('shop-slug').value.trim();
  document.getElementById('shop-slug-preview').textContent = slug ? `Adresse : ${location.origin}/b/${slug}` : '';
}

// ---------- Boutique ----------

function fillShopForm() {
  document.getElementById('shop-name').value = shopInfo?.name || '';
  document.getElementById('shop-slug').value = shopInfo?.slug || '';
  document.getElementById('shop-currency').value = shopInfo?.currency || 'XOF';
  document.getElementById('shop-desc').value = shopInfo?.description || '';
  document.getElementById('shop-whatsapp').value = shopInfo?.whatsapp || '';
  document.getElementById('shop-orange').value = shopInfo?.orange_money || '';
  document.getElementById('shop-moov').value = shopInfo?.moov_money || '';
  document.getElementById('shop-wave').value = shopInfo?.wave || '';
  document.getElementById('shop-note').value = shopInfo?.payment_note || '';
  document.getElementById('shop-active').checked = Boolean(shopInfo?.is_active);
  document.getElementById('shop-currency').disabled = Boolean(shopInfo && shopProducts.length);
  updateShopUrlPreview();
}

async function saveShop() {
  const messageEl = document.getElementById('boutique-message');
  clearMessage(messageEl);

  const body = {
    name: document.getElementById('shop-name').value.trim(),
    slug: document.getElementById('shop-slug').value.trim().toLowerCase(),
    currency: document.getElementById('shop-currency').value,
    description: document.getElementById('shop-desc').value.trim(),
    whatsapp: document.getElementById('shop-whatsapp').value.trim(),
    orange_money: document.getElementById('shop-orange').value.trim(),
    moov_money: document.getElementById('shop-moov').value.trim(),
    wave: document.getElementById('shop-wave').value.trim(),
    payment_note: document.getElementById('shop-note').value.trim(),
    is_active: document.getElementById('shop-active').checked,
  };
  if (!body.name) return showMessage(messageEl, 'Le nom de la boutique est requis.', 'error');
  if (!body.slug) return showMessage(messageEl, "L'adresse de la boutique est requise (ex : kofa-shop).", 'error');
  if (body.whatsapp && !phoneToWhatsappNumber(body.whatsapp)) {
    return showMessage(messageEl, "Indiquez votre numéro WhatsApp avec l'indicatif du pays, par exemple +223 70 00 00 00.", 'error');
  }
  if (body.is_active && !body.orange_money && !body.moov_money && !body.wave) {
    return showMessage(messageEl, "Renseignez au moins un numéro de paiement (Orange Money, Moov Money ou Wave) avant d'ouvrir la boutique.", 'error');
  }
  if (shopInfo && shopProducts.length) delete body.currency; // la devise ne change plus une fois des produits créés

  const headers = await authHeadersOrNull();
  if (!headers) return;

  const btn = document.getElementById('btn-save-shop');
  const wasNew = !shopInfo;
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/shop`, { method: 'PUT', headers, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error(data.error || "Impossible d'enregistrer la boutique.");
    showMessage(messageEl, body.is_active ? 'Boutique enregistrée et ouverte au public.' : 'Boutique enregistrée. Elle est fermée : ouvrez-la quand vous êtes prêt.', 'success');
    await loadBoutique();
    // Boutique tout juste créée : on ouvre la suite logique, l'ajout de produits.
    if (wasNew && shopInfo && !shopProducts.length) document.getElementById('shop-products-box').open = true;
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
  } finally {
    btn.disabled = false;
  }
}

function renderShopLink() {
  const box = document.getElementById('shop-link-box');
  if (!shopInfo) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  const state = shopInfo.is_active
    ? '<span style="color:#86efac;font-weight:600;">● Ouverte</span>'
    : '<span style="color:#fde047;font-weight:600;">● Fermée (invisible pour vos clients)</span>';
  box.innerHTML = `
    <div style="font-weight:600;">${escapeHtml(shopInfo.name)} · ${state}</div>
    <div class="muted" style="font-size:13px;word-break:break-all;margin:4px 0 8px;">${escapeHtml(shopInfo.shop_url || '')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="secondary" data-shop-action="copy">🔗 Copier le lien</button>
      <button class="secondary" data-shop-action="share">💬 Partager sur WhatsApp</button>
      <a href="${escapeHtml(shopInfo.shop_url || '#')}" target="_blank" rel="noopener" style="align-self:center;">Ouvrir ma boutique →</a>
    </div>`;
}

async function copyShopLink() {
  const messageEl = document.getElementById('boutique-message');
  try {
    await navigator.clipboard.writeText(shopInfo.shop_url);
    showMessage(messageEl, 'Lien de la boutique copié. Collez-le dans votre bio TikTok, Instagram ou WhatsApp.', 'success');
  } catch {
    showMessage(messageEl, `Copiez ce lien : ${escapeHtml(shopInfo.shop_url)}`, 'success');
  }
}

// ---------- Produits ----------

function refreshProductFormKind() {
  const kind = document.getElementById('product-kind').value;
  document.getElementById('product-digital-box').classList.toggle('hidden', kind !== 'numerique');
  document.getElementById('product-stock-box').classList.toggle('hidden', kind !== 'physique');
  const label = shopCurrency() === 'EUR' ? '€' : 'F CFA';
  document.getElementById('product-price-label').textContent = `Prix (${label})`;
}

function openProductForm(product) {
  const messageEl = document.getElementById('boutique-message');
  clearMessage(messageEl);
  if (!shopInfo) {
    showMessage(messageEl, "Créez d'abord votre boutique dans « Réglages de la boutique » (nom, adresse et numéro de paiement).", 'error');
    document.getElementById('shop-settings-box').open = true;
    return;
  }

  editingProductId = product ? product.id : null;
  document.getElementById('product-form-title').textContent = product ? 'Modifier le produit' : 'Nouveau produit';
  document.getElementById('btn-save-product').textContent = product ? 'Enregistrer' : 'Ajouter';
  document.getElementById('product-kind').value = product?.kind || 'numerique';
  document.getElementById('product-kind').disabled = Boolean(product); // le type ne change plus
  document.getElementById('product-name').value = product?.name || '';
  document.getElementById('product-desc').value = product?.description || '';
  const digits = product ? (Intl.NumberFormat('fr-FR', { style: 'currency', currency: shopCurrency() }).resolvedOptions().maximumFractionDigits) : 0;
  document.getElementById('product-price').value = product ? String(product.price_minor / 10 ** digits) : '';
  document.getElementById('product-digital').value = product?.digital_url || '';
  document.getElementById('product-stock').value = product && product.stock !== null ? String(product.stock) : '';
  document.getElementById('product-image').value = product?.image_url || '';
  document.getElementById('product-active').checked = product ? Boolean(product.is_active) : true;
  refreshProductFormKind();

  const form = document.getElementById('product-form');
  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('product-name').focus();
}

function closeProductForm() {
  editingProductId = null;
  document.getElementById('product-form').classList.add('hidden');
}

async function saveProduct() {
  const messageEl = document.getElementById('boutique-message');
  clearMessage(messageEl);

  const kind = document.getElementById('product-kind').value;
  const price = parseAmountToMinor(document.getElementById('product-price').value, shopCurrency());
  const name = document.getElementById('product-name').value.trim();
  if (!name) return showMessage(messageEl, 'Le nom du produit est requis.', 'error');
  if (!price) return showMessage(messageEl, 'Indiquez un prix valide (ex : 5000).', 'error');

  const body = {
    kind,
    name,
    description: document.getElementById('product-desc').value.trim(),
    price_minor: price,
    image_url: document.getElementById('product-image').value.trim(),
    is_active: document.getElementById('product-active').checked,
  };
  if (kind === 'numerique') {
    body.digital_url = document.getElementById('product-digital').value.trim();
    if (body.digital_url && !/^https?:\/\//i.test(body.digital_url)) {
      return showMessage(messageEl, 'Le lien de téléchargement doit commencer par https://.', 'error');
    }
  } else {
    const rawStock = document.getElementById('product-stock').value.trim();
    if (rawStock === '') {
      body.stock = null;
    } else if (/^\d+$/.test(rawStock)) {
      body.stock = Number(rawStock);
    } else {
      return showMessage(messageEl, 'Le stock doit être un nombre entier (ou vide pour un stock illimité).', 'error');
    }
  }
  if (body.image_url && !/^https?:\/\//i.test(body.image_url)) {
    return showMessage(messageEl, "L'adresse de la photo doit commencer par https://.", 'error');
  }

  const headers = await authHeadersOrNull();
  if (!headers) return;

  const isEdit = Boolean(editingProductId);
  const btn = document.getElementById('btn-save-product');
  btn.disabled = true;
  try {
    const url = isEdit ? `${API_BASE_URL}/api/shop/products/${editingProductId}` : `${API_BASE_URL}/api/shop/products`;
    if (isEdit) delete body.kind;
    const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error(data.error || "Impossible d'enregistrer le produit.");
    closeProductForm();
    showMessage(messageEl, isEdit ? 'Produit modifié.' : 'Produit ajouté.', 'success');
    await loadBoutique();
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
  } finally {
    btn.disabled = false;
  }
}

async function toggleProductActive(product, btn) {
  const messageEl = document.getElementById('boutique-message');
  clearMessage(messageEl);
  const headers = await authHeadersOrNull();
  if (!headers) return;
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/shop/products/${product.id}`, { method: 'PUT', headers, body: JSON.stringify({ is_active: !product.is_active }) });
    let data = {};
    try { data = await res.json(); } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error(data.error || 'Impossible de modifier le produit.');
    await loadBoutique();
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
    btn.disabled = false;
  }
}

async function deleteProduct(product, btn) {
  const messageEl = document.getElementById('boutique-message');
  clearMessage(messageEl);
  if (!window.confirm(`Supprimer le produit « ${product.name} » ? Vos commandes déjà passées sont conservées.`)) return;
  const headers = await authHeadersOrNull();
  if (!headers) return;
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/shop/products/${product.id}`, { method: 'DELETE', headers });
    if (!res.ok) {
      let data = {};
      try { data = await res.json(); } catch { /* réponse non JSON */ }
      throw new Error(data.error || 'Impossible de supprimer le produit.');
    }
    if (editingProductId === product.id) closeProductForm();
    showMessage(messageEl, 'Produit supprimé.', 'success');
    await loadBoutique();
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
    btn.disabled = false;
  }
}

function renderShopProducts() {
  const listEl = document.getElementById('shop-products-list');
  document.getElementById('shop-products-summary').textContent = `📦 Produits (${shopProducts.length})`;

  if (!shopProducts.length) {
    listEl.innerHTML = '<p class="muted">Aucun produit pour l\'instant. Cliquez sur « + Nouveau produit ».</p>';
    return;
  }

  listEl.innerHTML = shopProducts
    .map((p) => {
      const id = escapeHtml(String(p.id));
      const kind = p.kind === 'numerique' ? '💾 Numérique' : '📦 Physique';
      let stock = '';
      if (p.kind === 'physique') stock = p.stock === null ? ' · stock illimité' : p.stock === 0 ? ' · <span style="color:#fca5a5;">rupture de stock</span>' : ` · ${p.stock} en stock`;
      const warning = p.kind === 'numerique' && !p.digital_url ? '<div style="font-size:12px;color:#fde047;">⚠️ Ajoutez le lien de téléchargement pour pouvoir livrer ce produit.</div>' : '';
      return `
        <div style="padding:10px 0;border-top:1px solid rgba(255,255,255,0.12);${p.is_active ? '' : 'opacity:0.6;'}">
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
            <div style="flex:1;min-width:180px;">
              <strong>${escapeHtml(p.name)}</strong> ${p.is_active ? '' : '<span class="muted">(masqué)</span>'}
              <div class="muted" style="font-size:13px;">${kind} · ${escapeHtml(formatQuoteAmount(p.price_minor, shopCurrency()))}${stock}</div>
              ${warning}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="secondary" data-product-action="edit" data-product-id="${id}">✏️ Modifier</button>
              <button class="secondary" data-product-action="toggle" data-product-id="${id}">${p.is_active ? '🙈 Masquer' : '👁 Afficher'}</button>
              <button class="secondary" data-product-action="delete" data-product-id="${id}" title="Supprimer ce produit">🗑</button>
            </div>
          </div>
        </div>`;
    })
    .join('');
}

// ---------- Commandes ----------

function orderWhatsappUrl(order) {
  const digits = phoneToWhatsappNumber(order.buyer_phone);
  const ref = shopReference(order);
  let text;
  if (order.status === 'paye' || order.status === 'livre') {
    text = `Bonjour ${order.buyer_name}, nous avons bien reçu votre paiement pour la commande ${ref}. Merci ! Suivez votre commande ici : ${order.tracking_url}`;
  } else if (order.status === 'expedie') {
    text = `Bonjour ${order.buyer_name}, votre commande ${ref} a été expédiée. Suivi : ${order.tracking_url}`;
  } else {
    text = `Bonjour ${order.buyer_name}, voici le suivi de votre commande ${ref} (instructions de paiement incluses) : ${order.tracking_url}`;
  }
  return `https://wa.me/${digits || ''}?text=${encodeURIComponent(text)}`;
}

function openOrderWhatsapp(order) {
  window.open(orderWhatsappUrl(order), '_blank', 'noopener');
}

async function runOrderAction(order, action, btn) {
  const messageEl = document.getElementById('boutique-message');
  clearMessage(messageEl);

  const amount = formatQuoteAmount(order.total_minor, order.currency);
  if (action === 'confirm') {
    const via = order.payment_operator ? ` sur votre ${SHOP_OPERATOR_LABELS[order.payment_operator] || 'compte'}` : ' dans votre application';
    if (!window.confirm(`Avez-vous bien reçu ${amount}${via} ? Cette action débloque le produit pour ${order.buyer_name}.`)) return;
  }
  if (action === 'cancel') {
    const paidWarning = order.status === 'paye' ? ' Le paiement a déjà été confirmé : pensez à rembourser le client vous-même.' : '';
    if (!window.confirm(`Annuler la commande ${shopReference(order)} de ${order.buyer_name} ?${paidWarning}`)) return;
  }

  const headers = await authHeadersOrNull();
  if (!headers) return;

  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/shop/orders/${order.id}/${action}`, { method: 'POST', headers });
    let data = {};
    try { data = await res.json(); } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error(data.error || "Impossible de mettre à jour la commande.");
    await loadBoutique();
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
    btn.disabled = false;
  }
}

function renderShopOrders() {
  const listEl = document.getElementById('shop-orders-list');
  const toCheck = shopOrders.filter((o) => o.status === 'paiement_declare').length;
  document.getElementById('shop-orders-summary').textContent =
    `🧾 Commandes (${shopOrders.length})${toCheck ? ` · ${toCheck} paiement${toCheck > 1 ? 's' : ''} à vérifier` : ''}`;

  if (!shopOrders.length) {
    listEl.innerHTML = '<p class="muted">Aucune commande pour l\'instant. Partagez le lien de votre boutique pour recevoir la première.</p>';
    return;
  }

  const orders = shopOrders.filter((o) => {
    if (shopOrderFilter === 'all') return true;
    if (shopOrderFilter === 'paye') return o.status === 'paye' || o.status === 'expedie';
    return o.status === shopOrderFilter;
  });
  if (!orders.length) {
    listEl.innerHTML = '<p class="muted">Aucune commande dans cette catégorie.</p>';
    return;
  }

  listEl.innerHTML = orders
    .map((o) => {
      const id = escapeHtml(String(o.id));
      const btn = (action, label, primary) =>
        `<button class="${primary ? '' : 'secondary'}" data-order-action="${action}" data-order-id="${id}">${label}</button>`;

      const buttons = [];
      if (o.status === 'en_attente' || o.status === 'paiement_declare') buttons.push(btn('confirm', '✅ Confirmer le paiement', o.status === 'paiement_declare'));
      if (o.status === 'paye' && o.product_kind === 'physique') buttons.push(btn('ship', '📦 Marquer expédiée', true));
      if (o.status === 'paye' && o.product_kind === 'numerique') buttons.push(btn('deliver', '✔ Marquer livrée'));
      if (o.status === 'expedie') buttons.push(btn('deliver', '✔ Marquer livrée', true));
      buttons.push(btn('whatsapp', '💬 Écrire'));
      if (['en_attente', 'paiement_declare', 'paye'].includes(o.status)) buttons.push(btn('cancel', '✖ Annuler'));

      const declared = o.status === 'paiement_declare' && o.payment_reference
        ? `<div style="font-size:13px;color:#fde047;">Paiement déclaré : ${escapeHtml(SHOP_OPERATOR_LABELS[o.payment_operator] || '')} · n° de transaction <strong>${escapeHtml(o.payment_reference)}</strong></div>`
        : '';
      const address = o.delivery_address ? `<div class="muted" style="font-size:13px;">📍 ${escapeHtml(o.delivery_address)}</div>` : '';
      const note = o.buyer_note ? `<div class="muted" style="font-size:13px;">💬 « ${escapeHtml(o.buyer_note)} »</div>` : '';
      const date = new Date(o.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

      return `
        <div style="padding:10px 0;border-top:1px solid rgba(255,255,255,0.12);">
          <div><strong>${escapeHtml(o.product_name)}</strong> × ${o.quantity} · ${escapeHtml(formatQuoteAmount(o.total_minor, o.currency))} ${shopOrderBadge(o.status)}</div>
          <div class="muted" style="font-size:13px;">${escapeHtml(shopReference(o))} · ${escapeHtml(o.buyer_name)} · ${escapeHtml(o.buyer_phone)} · ${escapeHtml(date)}</div>
          ${declared}${address}${note}
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${buttons.join('')}</div>
        </div>`;
    })
    .join('');
}

// ---------- Chargement ----------

async function loadBoutique() {
  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const [shopRes, ordersRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/shop`, { headers }),
      fetch(`${API_BASE_URL}/api/shop/orders`, { headers }),
    ]);
    if (!shopRes.ok || !ordersRes.ok) throw new Error('Erreur de chargement de la boutique.');
    const shopData = await shopRes.json();
    shopInfo = shopData.shop;
    shopProducts = shopData.products || [];
    shopOrders = await ordersRes.json();

    fillShopForm();
    renderShopLink();
    renderShopProducts();
    renderShopOrders();
    // Première visite : on ouvre directement les réglages.
    if (!shopInfo) document.getElementById('shop-settings-box').open = true;
  } catch (err) {
    const listEl = document.getElementById('shop-orders-list');
    if (listEl) listEl.innerHTML = `<p class="muted">Erreur : ${escapeHtml(friendlyErrorMessage(err))}</p>`;
  }
}
