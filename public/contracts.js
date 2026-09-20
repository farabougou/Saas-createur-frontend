// ---------------------------------------------------------------------
// Contrats : rédaction assistée par l'IA, envoi par WhatsApp et signature
// électronique par le client (page publique sign.html).
//
// Chargé AVANT app.js (voir index.html). Comme contacts.js, il utilise des
// éléments définis ailleurs (el, authHeadersOrNull, API_BASE_URL,
// showMessage, clearMessage, escapeHtml, friendlyErrorMessage,
// refreshCreditsBadge dans app.js ; phoneToWhatsappNumber, quoteNumber,
// formatQuoteAmount, saveFileToDevice dans quotes.js ; allContacts dans contacts.js ;
// allQuotes, allSponsorships) : ils ne sont utilisés qu'au moment où
// l'utilisateur clique ou quand le tableau de bord se charge, une fois
// tous les fichiers chargés.
// ---------------------------------------------------------------------

let allContracts = [];
let editingContractId = null;
let openContractDetailsId = null;

const CONTRACT_KIND_LABELS = {
  prestation: 'Prestation de service',
  partenariat: 'Partenariat / sponsoring',
};

const CONTRACT_STATUS = {
  brouillon: { label: 'Brouillon', bg: 'rgba(148,163,184,0.18)', color: '#cbd5e1' },
  envoye: { label: 'En attente de signature', bg: 'rgba(234,179,8,0.18)', color: '#fde047' },
  signe: { label: 'Signé', bg: 'rgba(34,197,94,0.18)', color: '#86efac' },
  annule: { label: 'Annulé', bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
};

function contractStatusBadge(status) {
  const s = CONTRACT_STATUS[status] || CONTRACT_STATUS.brouillon;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${s.bg};color:${s.color};">${escapeHtml(s.label)}</span>`;
}

function ensureContractsUI() {
  if (document.getElementById('contracts-section')) return; // déjà injecté

  const section = document.createElement('div');
  section.id = 'contracts-section';
  section.className = 'card';
  section.style.marginTop = '20px';
  section.innerHTML = `
    <h3 style="margin-top:0;">📝 Contrats</h3>
    <p class="muted" style="margin-top:0;">
      Créez un contrat de prestation ou de partenariat avec l'aide de l'IA, envoyez-le par WhatsApp :
      votre client le lit et le signe en ligne, depuis son téléphone. La preuve de signature est conservée.
    </p>
    <div style="margin:12px 0;"><button id="btn-new-contract">+ Nouveau contrat</button></div>
    <div id="contract-form" class="hidden" style="margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;">
      <div id="contract-form-title" style="font-weight:600;margin-bottom:8px;">Nouveau contrat</div>
      <div id="contract-setup">
        <label for="contract-kind">Type de contrat</label>
        <select id="contract-kind">
          <option value="prestation">Prestation de service (pour un client)</option>
          <option value="partenariat">Partenariat / sponsoring (avec une marque)</option>
        </select>
        <label for="contract-link" id="contract-link-label">Devis lié (facultatif)</label>
        <select id="contract-link"></select>
        <label for="contract-contact">Contact (facultatif si vous choisissez un devis ou une marque)</label>
        <select id="contract-contact"></select>
        <label for="contract-counterparty">Ou nom de l'autre partie</label>
        <input id="contract-counterparty" maxlength="120" placeholder="Ex : Marie Diallo" />
        <label for="contract-details">Précisions pour l'IA (facultatif)</label>
        <textarea id="contract-details" rows="3" maxlength="2000" placeholder="Ex : 3 vidéos TikTok de 30 secondes, livrées sous 10 jours, 2 retouches incluses, paiement de 50 % à la commande."></textarea>
        <div style="margin-top:8px;"><button id="btn-generate-contract">✨ Rédiger avec l'IA (1 crédit)</button></div>
      </div>
      <label for="contract-title">Titre du contrat</label>
      <input id="contract-title" maxlength="200" />
      <label for="contract-content">Texte du contrat (vous pouvez le modifier)</label>
      <textarea id="contract-content" rows="16" maxlength="30000" placeholder="Cliquez sur « Rédiger avec l'IA », ou écrivez votre contrat ici."></textarea>
      <p class="muted" style="font-size:12px;margin:6px 0 0;">
        Ce texte est un modèle généré automatiquement : relisez-le attentivement, complétez les passages
        entre [crochets], et faites-le valider par un professionnel du droit pour les montants importants.
      </p>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button id="btn-save-contract">Enregistrer le brouillon</button>
        <button class="secondary" id="btn-cancel-contract">Annuler</button>
      </div>
    </div>
    <div id="contracts-message"></div>
    <div id="contracts-list" style="margin-top:12px;"></div>
  `;

  el.extraTools.appendChild(section);

  document.getElementById('btn-new-contract').addEventListener('click', () => openContractForm(null));
  document.getElementById('btn-cancel-contract').addEventListener('click', closeContractForm);
  document.getElementById('btn-save-contract').addEventListener('click', saveContract);
  document.getElementById('btn-generate-contract').addEventListener('click', generateContract);
  document.getElementById('contract-kind').addEventListener('change', refreshContractLinkOptions);

  // Un seul écouteur pour tous les boutons de la liste (elle est redessinée
  // à chaque changement).
  document.getElementById('contracts-list').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-contract-action]');
    if (!btn) return;
    const contract = allContracts.find((c) => String(c.id) === btn.dataset.contractId);
    if (!contract) return;
    const action = btn.dataset.contractAction;
    if (action === 'details') toggleContractDetails(contract);
    if (action === 'edit') openContractForm(contract);
    if (action === 'send') sendContract(contract, btn);
    if (action === 'pdf') downloadContractPdf(contract, btn);
    if (action === 'whatsapp') openContractWhatsapp(contract);
    if (action === 'copy') copyContractLink(contract);
    if (action === 'cancel') cancelContract(contract, btn);
    if (action === 'delete') deleteContract(contract, btn);
  });
}

// Remplit les listes déroulantes (devis / marques et contacts) avec les
// données déjà chargées par le tableau de bord.
function refreshContractLinkOptions() {
  const kindEl = document.getElementById('contract-kind');
  const linkEl = document.getElementById('contract-link');
  const labelEl = document.getElementById('contract-link-label');
  const contactEl = document.getElementById('contract-contact');
  if (!kindEl || !linkEl || !contactEl) return;

  const previousLink = linkEl.value;
  const previousContact = contactEl.value;

  linkEl.textContent = '';
  const isPartnership = kindEl.value === 'partenariat';
  labelEl.textContent = isPartnership ? 'Marque (sponsoring) liée (facultatif)' : 'Devis lié (facultatif)';

  const none = document.createElement('option');
  none.value = '';
  none.textContent = isPartnership ? 'Aucune marque sélectionnée' : 'Aucun devis sélectionné';
  linkEl.appendChild(none);

  if (isPartnership) {
    (typeof allSponsorships !== 'undefined' ? allSponsorships : []).forEach((s) => {
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = s.brand_name;
      linkEl.appendChild(option);
    });
  } else {
    (typeof allQuotes !== 'undefined' ? allQuotes : []).forEach((q) => {
      const option = document.createElement('option');
      option.value = q.id;
      option.textContent = `${quoteNumber(q)} · ${q.client_name} · ${formatQuoteAmount(q.amount_cents, q.currency)}`;
      linkEl.appendChild(option);
    });
  }
  if ([...linkEl.options].some((o) => o.value === previousLink)) linkEl.value = previousLink;

  contactEl.textContent = '';
  const noContact = document.createElement('option');
  noContact.value = '';
  noContact.textContent = 'Aucun contact sélectionné';
  contactEl.appendChild(noContact);
  (typeof allContacts !== 'undefined' ? allContacts : []).forEach((c) => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.company ? `${c.name} (${c.company})` : c.name;
    contactEl.appendChild(option);
  });
  if ([...contactEl.options].some((o) => o.value === previousContact)) contactEl.value = previousContact;
}

function openContractForm(contract) {
  editingContractId = contract ? contract.id : null;
  const isEdit = Boolean(contract);

  document.getElementById('contract-form-title').textContent = isEdit ? 'Modifier le brouillon' : 'Nouveau contrat';
  document.getElementById('btn-save-contract').textContent = isEdit ? 'Enregistrer les modifications' : 'Enregistrer le brouillon';
  // En modification, on ne peut plus changer les parties ni relancer l'IA : seul le texte se corrige.
  document.getElementById('contract-setup').classList.toggle('hidden', isEdit);

  refreshContractLinkOptions();
  clearMessage(document.getElementById('contracts-message'));

  if (isEdit) {
    document.getElementById('contract-title').value = contract.title || '';
    document.getElementById('contract-content').value = 'Chargement…';
    loadContractTextInto(contract.id);
  } else {
    document.getElementById('contract-kind').value = 'prestation';
    refreshContractLinkOptions();
    document.getElementById('contract-link').value = '';
    document.getElementById('contract-contact').value = '';
    document.getElementById('contract-counterparty').value = '';
    document.getElementById('contract-details').value = '';
    document.getElementById('contract-title').value = '';
    document.getElementById('contract-content').value = '';
  }

  const form = document.getElementById('contract-form');
  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function loadContractTextInto(id) {
  const contentEl = document.getElementById('contract-content');
  const headers = await authHeadersOrNull();
  if (!headers) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts/${id}`, { headers });
    if (!res.ok) throw new Error('Impossible de charger le contrat.');
    const full = await res.json();
    if (editingContractId !== id) return; // l'utilisateur a fermé ou changé de contrat
    contentEl.value = full.content || '';
  } catch (err) {
    contentEl.value = '';
    showMessage(document.getElementById('contracts-message'), escapeHtml(friendlyErrorMessage(err)), 'error');
  }
}

function closeContractForm() {
  editingContractId = null;
  document.getElementById('contract-form').classList.add('hidden');
}

// Lit les choix de la zone « parties » du formulaire (champs vides ignorés).
function collectContractSetup() {
  const kind = document.getElementById('contract-kind').value;
  const link = document.getElementById('contract-link').value;
  const body = { kind };
  if (link) body[kind === 'partenariat' ? 'sponsorship_id' : 'quote_id'] = link;
  const contactId = document.getElementById('contract-contact').value;
  if (contactId) body.contact_id = contactId;
  const counterparty = document.getElementById('contract-counterparty').value.trim();
  if (counterparty) body.counterparty_name = counterparty;
  return body;
}

async function generateContract() {
  const messageEl = document.getElementById('contracts-message');
  clearMessage(messageEl);

  const body = collectContractSetup();
  if (!body.quote_id && !body.sponsorship_id && !body.contact_id && !body.counterparty_name) {
    showMessage(messageEl, "Choisissez un devis, une marque ou un contact, ou saisissez le nom de l'autre partie.", 'error');
    return;
  }
  const details = document.getElementById('contract-details').value.trim();
  if (details) body.details = details;

  const headers = await authHeadersOrNull();
  if (!headers) return;

  const btn = document.getElementById('btn-generate-contract');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Rédaction en cours…';

  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts/generate`, { method: 'POST', headers, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error(data.error || 'Impossible de rédiger le contrat.');

    document.getElementById('contract-title').value = data.title || '';
    document.getElementById('contract-content').value = data.content || '';
    if (data.contact_id) {
      const contactEl = document.getElementById('contract-contact');
      if ([...contactEl.options].some((o) => o.value === data.contact_id)) contactEl.value = data.contact_id;
    }
    showMessage(messageEl, 'Contrat rédigé. Relisez-le, complétez les passages entre [crochets], puis enregistrez le brouillon.', 'success');
    if (typeof refreshCreditsBadge === 'function') refreshCreditsBadge();
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

async function saveContract() {
  const messageEl = document.getElementById('contracts-message');
  clearMessage(messageEl);

  const title = document.getElementById('contract-title').value.trim();
  const content = document.getElementById('contract-content').value.trim();
  if (!title) {
    showMessage(messageEl, 'Le titre du contrat est requis.', 'error');
    return;
  }
  if (!content) {
    showMessage(messageEl, 'Le texte du contrat est vide : rédigez-le avec l\'IA ou écrivez-le vous-même.', 'error');
    return;
  }

  const isEdit = Boolean(editingContractId);
  let body = { title, content };
  if (!isEdit) {
    body = { ...collectContractSetup(), title, content };
    if (!body.quote_id && !body.sponsorship_id && !body.contact_id && !body.counterparty_name) {
      showMessage(messageEl, "Choisissez un devis, une marque ou un contact, ou saisissez le nom de l'autre partie.", 'error');
      return;
    }
  }

  const headers = await authHeadersOrNull();
  if (!headers) return;

  const btn = document.getElementById('btn-save-contract');
  btn.disabled = true;

  try {
    const url = isEdit ? `${API_BASE_URL}/api/contracts/${editingContractId}` : `${API_BASE_URL}/api/contracts`;
    const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error(data.error || "Impossible d'enregistrer le contrat.");

    closeContractForm();
    showMessage(messageEl, isEdit ? 'Brouillon modifié.' : 'Brouillon enregistré. Vous pouvez maintenant l\'envoyer à votre client.', 'success');
    await loadContracts();
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
  } finally {
    btn.disabled = false;
  }
}

// Message proposé au client avec le lien de signature.
function contractWhatsappUrl(contract) {
  const contact = typeof allContacts !== 'undefined' ? allContacts.find((c) => c.id === contract.contact_id) : null;
  const digits = contact ? phoneToWhatsappNumber(contact.phone) : null;
  const greeting = contract.counterparty_name ? `Bonjour ${contract.counterparty_name},` : 'Bonjour,';
  const text = [
    greeting,
    '',
    `Voici le contrat « ${contract.title} » à lire et signer en ligne (une minute, depuis votre téléphone) :`,
    contract.sign_url,
    '',
    'Merci !',
  ].join('\n');
  return `https://wa.me/${digits || ''}?text=${encodeURIComponent(text)}`;
}

function openContractWhatsapp(contract) {
  if (!contract.sign_url) return;
  window.open(contractWhatsappUrl(contract), '_blank', 'noopener');
}

async function copyContractLink(contract) {
  const messageEl = document.getElementById('contracts-message');
  clearMessage(messageEl);
  if (!contract.sign_url) return;
  try {
    await navigator.clipboard.writeText(contract.sign_url);
    showMessage(messageEl, 'Lien de signature copié. Vous pouvez le coller dans une conversation ou un e-mail.', 'success');
  } catch {
    showContractLinkMessage(contract, 'Copiez ce lien pour l\'envoyer à votre client :');
  }
}

// Affiche le lien de signature avec un bouton WhatsApp (créé avec le DOM
// pour ne jamais injecter de texte non maîtrisé dans du HTML).
function showContractLinkMessage(contract, intro) {
  const container = document.getElementById('contracts-message');
  container.textContent = '';

  const box = document.createElement('div');
  box.className = 'message success';

  const p = document.createElement('div');
  p.textContent = intro;
  box.appendChild(p);

  const input = document.createElement('input');
  input.readOnly = true;
  input.value = contract.sign_url || '';
  input.style.marginTop = '8px';
  input.addEventListener('focus', () => input.select());
  box.appendChild(input);

  const link = document.createElement('a');
  link.href = contractWhatsappUrl(contract);
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Ouvrir WhatsApp avec le message →';
  link.style.display = 'inline-block';
  link.style.marginTop = '8px';
  box.appendChild(link);

  container.appendChild(box);
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Télécharge le contrat en PDF (avec la preuve de signature s'il est signé).
async function downloadContractPdf(contract, btn) {
  const messageEl = document.getElementById('contracts-message');
  clearMessage(messageEl);

  const headers = await authHeadersOrNull();
  if (!headers) return;

  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '…';

  try {
    // Les dates du PDF s'affichent dans NOTRE fuseau horaire, pas celui du serveur.
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { tz = ''; }

    const res = await fetch(`${API_BASE_URL}/api/contracts/${contract.id}/pdf?tz=${encodeURIComponent(tz)}`, { headers });
    if (!res.ok) {
      let message = 'Impossible de générer le PDF.';
      try { message = (await res.json()).error || message; } catch { /* réponse non JSON */ }
      throw new Error(message);
    }
    const blob = await res.blob();
    const reference = `CT-${String(contract.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    saveFileToDevice(new File([blob], `${reference}.pdf`, { type: 'application/pdf' }));
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

async function sendContract(contract, btn) {
  const messageEl = document.getElementById('contracts-message');
  clearMessage(messageEl);

  if (!window.confirm(`Envoyer le contrat « ${contract.title} » ? Après l'envoi, son texte ne pourra plus être modifié.`)) return;

  const headers = await authHeadersOrNull();
  if (!headers) return;

  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts/${contract.id}/send`, { method: 'POST', headers });
    let data = {};
    try { data = await res.json(); } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error(data.error || "Impossible d'envoyer le contrat.");

    await loadContracts();
    const updated = allContracts.find((c) => c.id === contract.id) || data;
    showContractLinkMessage(updated, 'Contrat prêt à signer. Envoyez ce lien à votre client :');
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
    btn.disabled = false;
  }
}

async function cancelContract(contract, btn) {
  const messageEl = document.getElementById('contracts-message');
  clearMessage(messageEl);

  if (!window.confirm(`Annuler le contrat « ${contract.title} » ? Le lien de signature cessera immédiatement de fonctionner.`)) return;

  const headers = await authHeadersOrNull();
  if (!headers) return;

  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts/${contract.id}/cancel`, { method: 'POST', headers });
    let data = {};
    try { data = await res.json(); } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error(data.error || "Impossible d'annuler le contrat.");
    showMessage(messageEl, 'Contrat annulé. Le lien de signature ne fonctionne plus.', 'success');
    await loadContracts();
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
    btn.disabled = false;
  }
}

async function deleteContract(contract, btn) {
  const messageEl = document.getElementById('contracts-message');
  clearMessage(messageEl);

  if (!window.confirm(`Supprimer le contrat « ${contract.title} » ?`)) return;

  const headers = await authHeadersOrNull();
  if (!headers) return;

  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts/${contract.id}`, { method: 'DELETE', headers });
    if (!res.ok) {
      let data = {};
      try { data = await res.json(); } catch { /* réponse non JSON */ }
      throw new Error(data.error || 'Impossible de supprimer le contrat.');
    }
    if (editingContractId === contract.id) closeContractForm();
    if (openContractDetailsId === contract.id) openContractDetailsId = null;
    showMessage(messageEl, 'Contrat supprimé.', 'success');
    await loadContracts();
  } catch (err) {
    showMessage(messageEl, escapeHtml(friendlyErrorMessage(err)), 'error');
    btn.disabled = false;
  }
}

// Ouvre ou referme le détail d'un contrat : texte complet et, s'il est signé,
// la preuve de signature.
async function toggleContractDetails(contract) {
  const box = document.getElementById(`contract-details-${contract.id}`);
  if (!box) return;

  if (openContractDetailsId === contract.id) {
    openContractDetailsId = null;
    box.classList.add('hidden');
    return;
  }

  document.querySelectorAll('#contracts-list [data-contract-details]').forEach((other) => other.classList.add('hidden'));
  openContractDetailsId = contract.id;
  box.classList.remove('hidden');
  box.innerHTML = '<p class="muted" style="margin:0;">Chargement…</p>';

  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts/${contract.id}`, { headers });
    if (!res.ok) throw new Error('Impossible de charger le contrat.');
    const full = await res.json();
    if (openContractDetailsId !== contract.id) return; // l'utilisateur a changé entre-temps
    fillContractDetails(box, full);
  } catch (err) {
    box.innerHTML = `<p class="muted" style="margin:0;">Erreur : ${escapeHtml(friendlyErrorMessage(err))}</p>`;
  }
}

function fillContractDetails(box, full) {
  box.textContent = '';

  const text = document.createElement('div');
  text.textContent = full.content || '';
  text.style.cssText = 'white-space:pre-wrap;max-height:320px;overflow:auto;padding:8px;border-radius:8px;background:rgba(0,0,0,0.25);';
  box.appendChild(text);

  if (full.status !== 'signe') return;

  const proof = document.createElement('div');
  proof.style.marginTop = '12px';

  const heading = document.createElement('div');
  heading.style.fontWeight = '600';
  heading.textContent = 'Preuve de signature';
  proof.appendChild(heading);

  const who = document.createElement('div');
  who.textContent = `Signé par ${full.signer_name || '—'} le ${full.signed_at ? new Date(full.signed_at).toLocaleString('fr-FR') : '—'}`;
  proof.appendChild(who);

  const tech = document.createElement('div');
  tech.className = 'muted';
  tech.style.fontSize = '12px';
  const fingerprint = full.content_hash ? full.content_hash.slice(0, 16).toUpperCase() : '—';
  tech.textContent = `Adresse IP : ${full.signer_ip || '—'} · Empreinte du texte (SHA-256) : ${fingerprint}`;
  proof.appendChild(tech);

  if (typeof full.signature_image === 'string' && full.signature_image.startsWith('data:image/png;base64,')) {
    const img = document.createElement('img');
    img.src = full.signature_image;
    img.alt = 'Signature dessinée';
    img.style.cssText = 'display:block;margin-top:8px;max-width:280px;width:100%;border-radius:6px;background:#fff;';
    proof.appendChild(img);
  }

  box.appendChild(proof);
}

async function loadContracts() {
  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/contracts`, { headers });
    if (!res.ok) throw new Error('Erreur de chargement des contrats.');
    allContracts = await res.json();
    renderContracts();
    refreshContractLinkOptions();
  } catch (err) {
    const listEl = document.getElementById('contracts-list');
    if (listEl) listEl.innerHTML = `<p class="muted">Erreur : ${escapeHtml(friendlyErrorMessage(err))}</p>`;
  }
}

function renderContracts() {
  const listEl = document.getElementById('contracts-list');
  if (!listEl) return;

  if (!allContracts.length) {
    listEl.innerHTML = '<p class="muted">Aucun contrat pour l\'instant. Cliquez sur « + Nouveau contrat » pour créer le premier.</p>';
    return;
  }

  listEl.innerHTML = allContracts
    .map((c) => {
      const id = escapeHtml(String(c.id));
      const btn = (action, label, title) =>
        `<button class="secondary" data-contract-action="${action}" data-contract-id="${id}"${title ? ` title="${title}"` : ''}>${label}</button>`;

      const buttons = [btn('details', '📂 Voir')];
      if (c.status !== 'annule') buttons.push(btn('pdf', '📄 PDF', 'Télécharger le contrat en PDF'));
      if (c.status === 'brouillon') {
        buttons.push(btn('edit', '✏️ Modifier'), btn('send', '📤 Envoyer'), btn('delete', '🗑', 'Supprimer ce brouillon'));
      } else if (c.status === 'envoye') {
        buttons.push(btn('whatsapp', '💬 WhatsApp'), btn('copy', '🔗 Lien'), btn('cancel', '✖ Annuler', 'Annuler ce contrat'));
      } else if (c.status === 'annule') {
        buttons.push(btn('delete', '🗑', 'Supprimer ce contrat'));
      }

      const created = new Date(c.created_at).toLocaleDateString('fr-FR');
      const info = [CONTRACT_KIND_LABELS[c.kind] || '', c.counterparty_name || '', created].filter(Boolean).map(escapeHtml).join(' · ');

      let progress = '';
      if (c.status === 'envoye' && c.sent_at) {
        progress = `Envoyé le ${escapeHtml(new Date(c.sent_at).toLocaleDateString('fr-FR'))} · en attente de la signature`;
      } else if (c.status === 'signe' && c.signed_at) {
        progress = `Signé par ${escapeHtml(c.signer_name || '')} le ${escapeHtml(new Date(c.signed_at).toLocaleString('fr-FR'))}`;
      }

      return `
        <div style="padding:10px 0;border-top:1px solid rgba(255,255,255,0.12);">
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
            <div style="flex:1;min-width:180px;">
              <strong>${escapeHtml(c.title)}</strong> ${contractStatusBadge(c.status)}
              <div class="muted" style="font-size:13px;">${info}</div>
              ${progress ? `<div class="muted" style="font-size:12px;">${progress}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">${buttons.join('')}</div>
          </div>
          <div id="contract-details-${id}" data-contract-details class="hidden" style="margin-top:8px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.04);font-size:14px;"></div>
        </div>`;
    })
    .join('');

  // Le détail ouvert est rechargé après un rafraîchissement de la liste.
  if (openContractDetailsId) {
    const stillThere = allContracts.find((c) => c.id === openContractDetailsId);
    openContractDetailsId = null;
    if (stillThere) toggleContractDetails(stillThere);
  }
}
