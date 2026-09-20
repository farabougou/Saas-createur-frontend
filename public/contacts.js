// ---------------------------------------------------------------------
// Contacts (CRM) : carnet d'adresses des clients et des marques.
//
// Chargé AVANT app.js (voir index.html). Comme quotes.js, il utilise des
// éléments définis dans app.js (el, authHeadersOrNull, API_BASE_URL,
// showMessage, clearMessage, escapeHtml, friendlyErrorMessage) et dans
// quotes.js (phoneToWhatsappNumber, quoteNumber, formatQuoteAmount,
// quoteStatusBadge) : ils ne sont utilisés qu'au moment où l'utilisateur
// clique, une fois tous les fichiers chargés.
// ---------------------------------------------------------------------

let allContacts = [];
let editingContactId = null;
let openContactDetailsId = null;

const CONTACT_TYPE_LABELS = { client: 'Client', marque: 'Marque', autre: 'Autre' };
const CONTACT_TYPE_COLORS = {
  client: { bg: 'rgba(59,130,246,0.18)', color: '#93c5fd' },
  marque: { bg: 'rgba(168,85,247,0.18)', color: '#d8b4fe' },
  autre: { bg: 'rgba(148,163,184,0.18)', color: '#cbd5e1' },
};
const CONTACT_SPONSOR_STATUS_LABELS = {
  a_contacter: 'À contacter',
  en_negociation: 'En négociation',
  signe: 'Signé',
};

function contactTypeBadge(type) {
  const colors = CONTACT_TYPE_COLORS[type] || CONTACT_TYPE_COLORS.autre;
  const label = CONTACT_TYPE_LABELS[type] || 'Autre';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${colors.bg};color:${colors.color};">${escapeHtml(label)}</span>`;
}

function ensureContactsUI() {
  if (document.getElementById('contacts-section')) return; // déjà injecté

  const section = document.createElement('div');
  section.id = 'contacts-section';
  section.className = 'card';
  section.style.marginTop = '20px';
  section.innerHTML = `
    <h3 style="margin-top:0;">📇 Contacts</h3>
    <p class="muted" style="margin-top:0;">
      Votre carnet d'adresses : vos clients et les marques avec lesquelles vous travaillez, au même endroit.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0;">
      <input id="contact-search" type="search" placeholder="Rechercher (nom, entreprise, e-mail)" style="flex:1;min-width:200px;" />
      <select id="contact-filter-type">
        <option value="">Tous</option>
        <option value="client">Clients</option>
        <option value="marque">Marques</option>
        <option value="autre">Autres</option>
      </select>
      <button id="btn-new-contact">+ Nouveau contact</button>
    </div>
    <div id="contact-form" class="hidden" style="margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;">
      <div id="contact-form-title" style="font-weight:600;margin-bottom:8px;">Nouveau contact</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;">
        <input id="contact-name" maxlength="120" placeholder="Nom *" />
        <select id="contact-type">
          <option value="client">Client</option>
          <option value="marque">Marque</option>
          <option value="autre">Autre</option>
        </select>
        <input id="contact-company" maxlength="120" placeholder="Entreprise (facultatif)" />
        <input id="contact-email" type="email" maxlength="200" placeholder="E-mail (facultatif)" />
        <input id="contact-phone" type="tel" maxlength="40" placeholder="N° WhatsApp (+223 70 00 00 00)" />
      </div>
      <textarea id="contact-notes" rows="2" maxlength="5000" placeholder="Notes (facultatif)" style="width:100%;margin-top:8px;"></textarea>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button id="btn-save-contact">Ajouter</button>
        <button class="secondary" id="btn-cancel-contact">Annuler</button>
      </div>
    </div>
    <div id="contacts-message"></div>
    <div id="contacts-list" style="margin-top:12px;"></div>
  `;

  el.extraTools.appendChild(section);

  document.getElementById('btn-new-contact').addEventListener('click', () => openContactForm(null));
  document.getElementById('btn-cancel-contact').addEventListener('click', closeContactForm);
  document.getElementById('btn-save-contact').addEventListener('click', saveContact);
  document.getElementById('contact-search').addEventListener('input', renderContacts);
  document.getElementById('contact-filter-type').addEventListener('change', renderContacts);

  // Un seul écouteur pour tous les boutons de la liste (elle est redessinée
  // à chaque changement).
  document.getElementById('contacts-list').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-contact-action]');
    if (!btn) return;
    const contact = allContacts.find((c) => String(c.id) === btn.dataset.contactId);
    if (!contact) return;
    const action = btn.dataset.contactAction;
    if (action === 'details') toggleContactDetails(contact);
    if (action === 'edit') openContactForm(contact);
    if (action === 'delete') deleteContact(contact, btn);
    if (action === 'whatsapp') openContactWhatsapp(contact);
    if (action === 'email') window.location.href = `mailto:${encodeURI(contact.email)}`;
  });
}

function openContactForm(contact) {
  editingContactId = contact ? contact.id : null;
  document.getElementById('contact-form-title').textContent = contact ? 'Modifier le contact' : 'Nouveau contact';
  document.getElementById('btn-save-contact').textContent = contact ? 'Enregistrer' : 'Ajouter';
  document.getElementById('contact-name').value = contact?.name || '';
  document.getElementById('contact-type').value = contact?.type || 'client';
  document.getElementById('contact-company').value = contact?.company || '';
  document.getElementById('contact-email').value = contact?.email || '';
  document.getElementById('contact-phone').value = contact?.phone || '';
  document.getElementById('contact-notes').value = contact?.notes || '';
  clearMessage(document.getElementById('contacts-message'));
  const form = document.getElementById('contact-form');
  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('contact-name').focus();
}

function closeContactForm() {
  editingContactId = null;
  document.getElementById('contact-form').classList.add('hidden');
}

async function saveContact() {
  const messageEl = document.getElementById('contacts-message');
  clearMessage(messageEl);

  const body = {
    name: document.getElementById('contact-name').value.trim(),
    type: document.getElementById('contact-type').value,
    company: document.getElementById('contact-company').value.trim(),
    email: document.getElementById('contact-email').value.trim(),
    phone: document.getElementById('contact-phone').value.trim(),
    notes: document.getElementById('contact-notes').value.trim(),
  };

  if (!body.name) {
    showMessage(messageEl, 'Le nom du contact est requis.', 'error');
    return;
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    showMessage(messageEl, "L'adresse e-mail n'est pas valide.", 'error');
    return;
  }
  if (body.phone && !phoneToWhatsappNumber(body.phone)) {
    showMessage(messageEl, "Indiquez le numéro avec l'indicatif du pays, par exemple +223 70 00 00 00 ou +33 6 12 34 56 78.", 'error');
    return;
  }

  const headers = await authHeadersOrNull();
  if (!headers) return;

  const isEdit = Boolean(editingContactId);
  const btn = document.getElementById('btn-save-contact');
  btn.disabled = true;

  try {
    const url = isEdit ? `${API_BASE_URL}/api/contacts/${editingContactId}` : `${API_BASE_URL}/api/contacts`;
    const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error(data.error || "Impossible d'enregistrer le contact.");

    closeContactForm();
    showMessage(messageEl, isEdit ? 'Contact modifié.' : 'Contact ajouté.', 'success');
    await loadContacts();
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteContact(contact, btn) {
  const messageEl = document.getElementById('contacts-message');
  clearMessage(messageEl);

  if (!window.confirm(`Supprimer le contact « ${contact.name} » ? Ses devis et ses sponsorings sont conservés : ils ne seront simplement plus rattachés à lui.`)) return;

  const headers = await authHeadersOrNull();
  if (!headers) return;

  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/contacts/${contact.id}`, { method: 'DELETE', headers });
    if (!res.ok) {
      let data = {};
      try { data = await res.json(); } catch { /* réponse non JSON */ }
      throw new Error(data.error || 'Impossible de supprimer le contact.');
    }
    if (editingContactId === contact.id) closeContactForm();
    if (openContactDetailsId === contact.id) openContactDetailsId = null;
    showMessage(messageEl, 'Contact supprimé.', 'success');
    await loadContacts();
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
    btn.disabled = false;
  }
}

function openContactWhatsapp(contact) {
  const digits = phoneToWhatsappNumber(contact.phone);
  if (!digits) return;
  window.open(`https://wa.me/${digits}`, '_blank', 'noopener');
}

// Ouvre ou referme la fiche d'un contact : notes, devis et sponsorings.
async function toggleContactDetails(contact) {
  const box = document.getElementById(`contact-details-${contact.id}`);
  if (!box) return;

  if (openContactDetailsId === contact.id) {
    openContactDetailsId = null;
    box.classList.add('hidden');
    return;
  }

  // Une seule fiche ouverte à la fois.
  document.querySelectorAll('#contacts-list [data-contact-details]').forEach((other) => other.classList.add('hidden'));
  openContactDetailsId = contact.id;
  box.classList.remove('hidden');
  box.innerHTML = '<p class="muted" style="margin:0;">Chargement…</p>';

  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/contacts/${contact.id}`, { headers });
    if (!res.ok) throw new Error('Impossible de charger la fiche du contact.');
    const full = await res.json();
    if (openContactDetailsId !== contact.id) return; // l'utilisateur a changé entre-temps
    box.innerHTML = renderContactDetails(full);
  } catch (err) {
    box.innerHTML = `<p class="muted" style="margin:0;">Erreur : ${escapeHtml(friendlyErrorMessage(err))}</p>`;
  }
}

function renderContactDetails(contact) {
  const notes = contact.notes
    ? `<div style="white-space:pre-wrap;margin-bottom:10px;">${escapeHtml(contact.notes)}</div>`
    : '<div class="muted" style="margin-bottom:10px;">Aucune note.</div>';

  const quotes = (contact.quotes || []).length
    ? contact.quotes
        .map((q) => {
          const date = new Date(q.created_at).toLocaleDateString('fr-FR');
          return `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;padding:4px 0;">
            <span>${escapeHtml(quoteNumber(q))} · ${date} ${quoteStatusBadge(q.status)}</span>
            <span style="font-weight:600;">${escapeHtml(formatQuoteAmount(q.amount_cents, q.currency))}</span>
          </div>`;
        })
        .join('')
    : '<div class="muted">Aucun devis rattaché.</div>';

  const sponsorships = (contact.sponsorships || []).length
    ? contact.sponsorships
        .map((s) => `<div style="padding:4px 0;">${escapeHtml(s.brand_name)} · <span class="muted">${escapeHtml(CONTACT_SPONSOR_STATUS_LABELS[s.status] || s.status || '')}</span></div>`)
        .join('')
    : '<div class="muted">Aucun sponsoring rattaché.</div>';

  return `
    ${notes}
    <div style="font-weight:600;">Devis</div>${quotes}
    <div style="font-weight:600;margin-top:10px;">Sponsorings</div>${sponsorships}
  `;
}

// Recharge le carnet après un changement fait ailleurs (devis, sponsoring)
// qui peut avoir créé un contact ou changé ses compteurs.
function refreshContactsIfReady() {
  if (document.getElementById('contacts-section')) loadContacts();
}

async function loadContacts() {
  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/contacts`, { headers });
    if (!res.ok) throw new Error('Erreur de chargement des contacts.');
    allContacts = await res.json();
    renderContacts();
    if (typeof refreshQuoteContactPicker === 'function') refreshQuoteContactPicker();
  } catch (err) {
    const listEl = document.getElementById('contacts-list');
    if (listEl) listEl.innerHTML = `<p class="muted">Erreur : ${escapeHtml(friendlyErrorMessage(err))}</p>`;
  }
}

function renderContacts() {
  const listEl = document.getElementById('contacts-list');
  if (!listEl) return;

  if (!allContacts.length) {
    listEl.innerHTML = '<p class="muted">Aucun contact pour l\'instant. Ajoutez votre premier client ou votre première marque.</p>';
    return;
  }

  const search = document.getElementById('contact-search').value.trim().toLowerCase();
  const type = document.getElementById('contact-filter-type').value;
  const contacts = allContacts.filter((c) => {
    if (type && c.type !== type) return false;
    if (!search) return true;
    return [c.name, c.company, c.email].filter(Boolean).some((v) => v.toLowerCase().includes(search));
  });

  if (!contacts.length) {
    listEl.innerHTML = '<p class="muted">Aucun contact ne correspond à cette recherche.</p>';
    return;
  }

  listEl.innerHTML = contacts
    .map((c) => {
      const id = escapeHtml(String(c.id));
      const links = [
        c.company ? escapeHtml(c.company) : '',
        c.email ? escapeHtml(c.email) : '',
        c.phone ? escapeHtml(c.phone) : '',
      ].filter(Boolean).join(' · ');
      const counts = [];
      if (c.quote_count) counts.push(`${c.quote_count} devis`);
      if (c.sponsorship_count) counts.push(`${c.sponsorship_count} sponsoring${c.sponsorship_count > 1 ? 's' : ''}`);
      const canWhatsapp = c.phone && phoneToWhatsappNumber(c.phone);
      const isOpen = openContactDetailsId === c.id;
      return `
        <div style="padding:10px 0;border-top:1px solid rgba(255,255,255,0.12);">
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
            <div style="flex:1;min-width:180px;">
              <strong>${escapeHtml(c.name)}</strong> ${contactTypeBadge(c.type)}
              ${links ? `<div class="muted" style="font-size:13px;">${links}</div>` : ''}
              ${counts.length ? `<div class="muted" style="font-size:12px;">${counts.join(' · ')}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="secondary" data-contact-action="details" data-contact-id="${id}">📂 Fiche</button>
              ${canWhatsapp ? `<button class="secondary" data-contact-action="whatsapp" data-contact-id="${id}">💬</button>` : ''}
              ${c.email ? `<button class="secondary" data-contact-action="email" data-contact-id="${id}">✉️</button>` : ''}
              <button class="secondary" data-contact-action="edit" data-contact-id="${id}">✏️ Modifier</button>
              <button class="secondary" data-contact-action="delete" data-contact-id="${id}" title="Supprimer ce contact">🗑</button>
            </div>
          </div>
          <div id="contact-details-${id}" data-contact-details class="${isOpen ? '' : 'hidden'}" style="margin-top:8px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.04);font-size:14px;"></div>
        </div>`;
    })
    .join('');

  // La fiche ouverte est rechargée après un rafraîchissement de la liste.
  if (openContactDetailsId) {
    const stillThere = contacts.find((c) => c.id === openContactDetailsId);
    openContactDetailsId = null;
    if (stillThere) toggleContactDetails(stillThere);
  }
}
