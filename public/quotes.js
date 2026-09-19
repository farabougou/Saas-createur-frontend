// ---------------------------------------------------------------------
// Devis & factures : création, liste, téléchargement du PDF et envoi par
// WhatsApp (avec le lien de paiement Stripe).
//
// Ce fichier est chargé AVANT app.js (voir index.html). Il utilise des
// éléments définis dans app.js (el, authHeadersOrNull, API_BASE_URL,
// showMessage, clearMessage, escapeHtml, friendlyErrorMessage) : ce n'est
// pas un problème, car ils ne sont utilisés qu'au moment où l'utilisateur
// clique, une fois que app.js est entièrement chargé.
// ---------------------------------------------------------------------

let allQuotes = [];

// Même règle que le backend (src/lib/quotePdf.js) : le numéro affiché sur
// le PDF et dans la liste doit être identique.
function quoteNumber(quote) {
  return `DEV-${String(quote.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

// Nombre de décimales de la devise : 2 pour l'euro (centimes), 0 pour le
// franc CFA (pas de centimes — c'est aussi la règle de Stripe).
function quoteCurrencyDigits(currency) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

function formatQuoteAmount(amountMinor, currency) {
  const code = (currency || 'EUR').toUpperCase();
  const value = amountMinor / 10 ** quoteCurrencyDigits(code);
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(value).replace(/[  ]/g, ' ');
  } catch {
    return `${value} ${code}`;
  }
}

// Convertit ce que l'utilisateur a tapé ("1 250,50") en montant pour l'API
// (125050 pour l'euro, 1250 pour le franc CFA). Renvoie null si invalide.
function parseAmountToMinor(input, currency) {
  const value = parseFloat(String(input).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const minor = Math.round(value * 10 ** quoteCurrencyDigits(currency));
  return minor > 0 ? minor : null;
}

// Transforme "+223 70 00 00 00" ou "0022370000000" en "22370000000" (format
// attendu par wa.me). Renvoie null si le numéro n'a pas d'indicatif pays :
// un numéro local comme "06 12 34 56 78" est ambigu (quel pays ?).
function phoneToWhatsappNumber(phone) {
  const raw = String(phone || '').trim();
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    // déjà international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else {
    return null;
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function ensureQuotesUI() {
  if (document.getElementById('quotes-section')) return; // déjà injecté

  const section = document.createElement('div');
  section.id = 'quotes-section';
  section.className = 'card';
  section.style.marginTop = '20px';
  section.innerHTML = `
    <h3 style="margin-top:0;">🧾 Devis &amp; paiement</h3>
    <p class="muted" style="margin-top:0;">
      Crée un devis avec un lien de paiement Stripe, puis envoie-le en PDF à ton client par WhatsApp.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0;">
      <span class="muted" style="font-size:13px;">Nom affiché sur tes devis :</span>
      <input id="quote-issuer-name" maxlength="80" placeholder="Ton nom ou celui de ton entreprise" style="flex:1;min-width:200px;" />
      <button class="secondary" id="btn-save-issuer">Enregistrer</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin:12px 0;">
      <input id="quote-client-name" placeholder="Nom du client" />
      <input id="quote-client-phone" type="tel" placeholder="N° WhatsApp (+223 70 00 00 00)" />
      <input id="quote-amount" inputmode="decimal" placeholder="Montant (ex : 250)" />
      <select id="quote-currency">
        <option value="EUR">Euro (€)</option>
        <option value="XOF">Franc CFA (F CFA)</option>
      </select>
    </div>
    <textarea id="quote-description" rows="2" placeholder="Description de la prestation" style="width:100%;"></textarea>
    <div style="margin-top:8px;"><button id="btn-create-quote">+ Créer le devis</button></div>
    <div id="quotes-message"></div>
    <div id="quotes-list" style="margin-top:12px;"></div>
  `;

  el.extraTools.appendChild(section);
  document.getElementById('btn-create-quote').addEventListener('click', createQuote);
  document.getElementById('btn-save-issuer').addEventListener('click', saveIssuerName);
  prefillIssuerName();

  // Un seul écouteur pour tous les boutons de la liste (la liste est
  // redessinée à chaque changement).
  document.getElementById('quotes-list').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-quote-action]');
    if (!btn) return;
    const quote = allQuotes.find((q) => String(q.id) === btn.dataset.quoteId);
    if (!quote) return;
    if (btn.dataset.quoteAction === 'pdf') downloadQuotePdf(quote, btn);
    if (btn.dataset.quoteAction === 'whatsapp') sendQuoteViaWhatsapp(quote, btn);
  });
}

// Le nom qui apparaît en haut à gauche du PDF ("Émetteur") est lu par le
// backend dans les informations du compte (user_metadata.full_name). On le
// modifie donc directement via Supabase Auth : aucune table à changer.
async function prefillIssuerName() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const name = session?.user?.user_metadata?.full_name || '';
    const input = document.getElementById('quote-issuer-name');
    if (input && !input.value) input.value = name;
  } catch {
    // pas grave : le champ reste vide
  }
}

async function saveIssuerName() {
  const messageEl = document.getElementById('quotes-message');
  clearMessage(messageEl);

  const full_name = document.getElementById('quote-issuer-name').value.trim();
  if (!full_name) {
    showMessage(messageEl, 'Indique le nom à afficher sur tes devis.', 'error');
    return;
  }

  const btn = document.getElementById('btn-save-issuer');
  btn.disabled = true;
  try {
    const { error } = await supabaseClient.auth.updateUser({ data: { full_name } });
    if (error) throw error;
    showMessage(messageEl, 'Nom enregistré : il apparaîtra sur tes PDF (y compris les anciens devis).', 'success');
  } catch (err) {
    showMessage(messageEl, friendlyErrorMessage(err), 'error');
  } finally {
    btn.disabled = false;
  }
}

async function loadQuotes() {
  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/quotes`, { headers });
    if (!res.ok) throw new Error('Erreur de chargement des devis.');
    allQuotes = await res.json();
    renderQuotes();
  } catch (err) {
    const listEl = document.getElementById('quotes-list');
    if (listEl) listEl.innerHTML = `<p class="muted">Erreur : ${friendlyErrorMessage(err)}</p>`;
  }
}

function renderQuotes() {
  const listEl = document.getElementById('quotes-list');
  if (!listEl) return;

  if (!allQuotes.length) {
    listEl.innerHTML = '<p class="muted">Aucun devis pour l\'instant.</p>';
    return;
  }

  listEl.innerHTML = allQuotes
    .map((q) => {
      const date = new Date(q.created_at).toLocaleDateString('fr-FR');
      const desc = q.description.length > 90 ? `${q.description.slice(0, 90)}…` : q.description;
      return `
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(255,255,255,0.12);">
          <div style="flex:1;min-width:180px;">
            <strong>${escapeHtml(q.client_name)}</strong>
            <span class="muted" style="font-size:12px;">${quoteNumber(q)} · ${date}</span>
            <div class="muted" style="font-size:13px;">${escapeHtml(desc)}</div>
          </div>
          <div style="font-weight:600;">${escapeHtml(formatQuoteAmount(q.amount_cents, q.currency))}</div>
          <div style="display:flex;gap:6px;">
            <button class="secondary" data-quote-action="pdf" data-quote-id="${escapeHtml(String(q.id))}">📄 PDF</button>
            <button data-quote-action="whatsapp" data-quote-id="${escapeHtml(String(q.id))}">💬 WhatsApp</button>
          </div>
        </div>`;
    })
    .join('');
}

async function createQuote() {
  const messageEl = document.getElementById('quotes-message');
  clearMessage(messageEl);

  const client_name = document.getElementById('quote-client-name').value.trim();
  const client_phone = document.getElementById('quote-client-phone').value.trim();
  const description = document.getElementById('quote-description').value.trim();
  const currency = document.getElementById('quote-currency').value;
  const amount_cents = parseAmountToMinor(document.getElementById('quote-amount').value, currency);

  if (!client_name || !client_phone || !description) {
    showMessage(messageEl, 'Le nom, le numéro WhatsApp et la description sont requis.', 'error');
    return;
  }
  if (!phoneToWhatsappNumber(client_phone)) {
    showMessage(messageEl, 'Indique le numéro avec l\'indicatif du pays, par exemple +223 70 00 00 00 ou +33 6 12 34 56 78.', 'error');
    return;
  }
  if (!amount_cents) {
    showMessage(messageEl, 'Le montant doit être un nombre positif.', 'error');
    return;
  }

  const headers = await authHeadersOrNull();
  if (!headers) return;

  const btn = document.getElementById('btn-create-quote');
  btn.disabled = true;
  btn.textContent = 'Création…';

  try {
    const res = await fetch(`${API_BASE_URL}/api/quotes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ client_name, client_phone, description, amount_cents, currency }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la création du devis.');

    document.getElementById('quote-client-name').value = '';
    document.getElementById('quote-client-phone').value = '';
    document.getElementById('quote-amount').value = '';
    document.getElementById('quote-description').value = '';
    showMessage(messageEl, 'Devis créé. Tu peux maintenant l\'envoyer par WhatsApp.', 'success');
    await loadQuotes();
  } catch (err) {
    showMessage(messageEl, friendlyErrorMessage(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Créer le devis';
  }
}

// Récupère le PDF depuis le backend (avec le jeton de connexion) et le
// renvoie sous forme de fichier prêt à être téléchargé ou partagé.
async function fetchQuotePdfFile(quote) {
  const headers = await authHeadersOrNull();
  if (!headers) throw new Error('Session expirée : reconnecte-toi.');

  const res = await fetch(`${API_BASE_URL}/api/quotes/${quote.id}/pdf`, { headers });
  if (!res.ok) {
    let message = 'Impossible de générer le PDF.';
    try { message = (await res.json()).error || message; } catch { /* réponse non JSON */ }
    throw new Error(message);
  }
  const blob = await res.blob();
  return new File([blob], `${quoteNumber(quote)}.pdf`, { type: 'application/pdf' });
}

function saveFileToDevice(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function downloadQuotePdf(quote, btn) {
  const messageEl = document.getElementById('quotes-message');
  clearMessage(messageEl);
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    saveFileToDevice(await fetchQuotePdfFile(quote));
  } catch (err) {
    showMessage(messageEl, friendlyErrorMessage(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// Envoi par WhatsApp.
//  - Sur téléphone : le menu de partage du système s'ouvre avec le PDF et le
//    message déjà prêts ; l'utilisateur choisit WhatsApp puis son client.
//  - Sinon (ordinateur) : on télécharge le PDF et on propose un lien qui
//    ouvre la conversation WhatsApp avec le message (dont le lien de
//    paiement) déjà écrit ; il n'y a plus qu'à joindre le PDF.
async function sendQuoteViaWhatsapp(quote, btn) {
  const messageEl = document.getElementById('quotes-message');
  clearMessage(messageEl);

  const waNumber = phoneToWhatsappNumber(quote.client_phone);
  if (!waNumber) {
    showMessage(messageEl, `Le numéro « ${escapeHtml(quote.client_phone)} » n'a pas d'indicatif pays : impossible d'ouvrir WhatsApp. Crée un nouveau devis avec un numéro du type +223 70 00 00 00.`, 'error');
    return;
  }

  const amount = formatQuoteAmount(quote.amount_cents, quote.currency);
  const lines = [
    `Bonjour ${quote.client_name},`,
    '',
    `Voici votre devis ${quoteNumber(quote)} : ${quote.description.length > 120 ? `${quote.description.slice(0, 120)}…` : quote.description}`,
    `Montant : ${amount}`,
  ];
  if (quote.stripe_payment_link) {
    lines.push('', `Vous pouvez le régler en ligne, en toute sécurité : ${quote.stripe_payment_link}`);
  }
  lines.push('', 'Merci !');
  const text = lines.join('\n');

  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '…';

  try {
    const file = await fetchQuotePdfFile(quote);

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, title: `Devis ${quoteNumber(quote)}` });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // l'utilisateur a fermé le menu : rien à faire
        // Autre refus (ex : le navigateur exige un geste plus récent) : on
        // bascule sur la méthode "téléchargement + lien WhatsApp" ci-dessous.
      }
    }

    saveFileToDevice(file);
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
    showMessage(
      messageEl,
      `Le PDF a été téléchargé. <a href="${waUrl}" target="_blank" rel="noopener">Ouvrir WhatsApp avec le message →</a> puis joins le fichier ${quoteNumber(quote)}.pdf dans la conversation.`,
      'success'
    );
  } catch (err) {
    showMessage(messageEl, friendlyErrorMessage(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}
