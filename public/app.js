// ---------------------------------------------------------------------
// Client Supabase (auth + session), créé une seule fois au chargement.
// ---------------------------------------------------------------------
const supabaseClient = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

const API_BASE_URL = window.APP_CONFIG.API_BASE_URL;

// Noms lisibles pour chaque type de contenu (doit correspondre aux
// <option value="..."> du formulaire dans index.html).
const CONTENT_TYPE_LABELS = {
  legende_instagram: 'Légende Instagram',
  script_tiktok: 'Script vidéo TikTok / Reels',
  titre_youtube: 'Idées de titres YouTube',
  description_youtube: 'Description YouTube (SEO)',
  hashtags: 'Suggestions de hashtags',
  idee_contenu: 'Idées de contenu',
  bio_profil: 'Bio de profil',
  reponse_commentaire: 'Réponse à un commentaire',
  story_instagram: 'Plan de story Instagram',
  collab_pitch: 'Message de proposition de collaboration',
};

// Noms lisibles pour chaque statut, affichés dans le badge de l'historique.
const STATUS_LABELS = {
  pending: 'En cours',
  completed: 'Terminé',
  failed: 'Échec',
};

function contentTypeLabel(type) {
  return CONTENT_TYPE_LABELS[type] || type;
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

// Transforme le texte formaté renvoyé par l'IA (titres, gras, listes) en
// vrai HTML grâce à marked.js, chargé dans index.html.
function renderAiResponse(text) {
  if (!text) return '';
  return window.marked.parse(text);
}

// Éléments de la page qu'on va manipuler souvent.
const el = {
  nav: document.getElementById('nav'),
  viewPublic: document.getElementById('view-public'),
  viewDashboard: document.getElementById('view-dashboard'),
  plansGrid: document.getElementById('plans-grid'),
  tabLogin: document.getElementById('tab-login'),
  tabSignup: document.getElementById('tab-signup'),
  formLogin: document.getElementById('form-login'),
  formSignup: document.getElementById('form-signup'),
  authMessage: document.getElementById('auth-message'),
  profileCard: document.getElementById('profile-card'),
  formAiRequest: document.getElementById('form-ai-request'),
  aiRequestMessage: document.getElementById('ai-request-message'),
  requestsList: document.getElementById('requests-list'),
  formCreatorProfile: document.getElementById('form-creator-profile'),
  creatorProfileMessage: document.getElementById('creator-profile-message'),
};

// Formate un prix stocké en "price_cents" (voir schéma Supabase). Le FCFA
// n'ayant pas de sous-unité, on affiche juste le nombre tel quel.
function formatPrice(plan) {
  if (plan.price_cents === 0) return 'Gratuit';
  return `${plan.price_cents} ${plan.currency}`;
}

function showMessage(container, text, type = 'error') {
  container.innerHTML = `<div class="message ${type}">${text}</div>`;
}

function clearMessage(container) {
  container.innerHTML = '';
}

// ---------------------------------------------------------------------
// 1. Plans publics — visibles par tout le monde, même déconnecté.
// ---------------------------------------------------------------------
async function loadPlans() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/plans`);
    if (!res.ok) throw new Error('Impossible de charger les offres.');
    const plans = await res.json();

    if (plans.length === 0) {
      el.plansGrid.innerHTML = '<p class="muted">Aucune offre disponible pour le moment.</p>';
      return;
    }

    el.plansGrid.innerHTML = plans
      .map(
        (plan) => `
        <div class="card">
          <h3>${plan.name}</h3>
          <div class="plan-price">${formatPrice(plan)} <span>/ mois</span></div>
          <p class="muted">${plan.monthly_request_quota} requêtes IA / mois</p>
        </div>
      `
      )
      .join('');
  } catch (err) {
    el.plansGrid.innerHTML = `<p class="muted">Erreur de chargement des offres (${err.message})</p>`;
  }
}

// ---------------------------------------------------------------------
// 2. Onglets Connexion / Inscription (juste un affichage conditionnel).
// ---------------------------------------------------------------------
el.tabLogin.addEventListener('click', () => {
  el.tabLogin.classList.add('active');
  el.tabSignup.classList.remove('active');
  el.formLogin.classList.remove('hidden');
  el.formSignup.classList.add('hidden');
  clearMessage(el.authMessage);
});

el.tabSignup.addEventListener('click', () => {
  el.tabSignup.classList.add('active');
  el.tabLogin.classList.remove('active');
  el.formSignup.classList.remove('hidden');
  el.formLogin.classList.add('hidden');
  clearMessage(el.authMessage);
});

// ---------------------------------------------------------------------
// 3. Inscription — crée le compte dans auth.users. Le trigger SQL
//    handle_new_user() créera automatiquement la ligne profiles associée.
// ---------------------------------------------------------------------
el.formSignup.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  const { error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    showMessage(el.authMessage, error.message, 'error');
    return;
  }

  showMessage(
    el.authMessage,
    'Compte créé ! Si la confirmation par email est activée sur ton projet Supabase, vérifie ta boîte mail avant de te connecter.',
    'success'
  );
});

// ---------------------------------------------------------------------
// 4. Connexion.
// ---------------------------------------------------------------------
el.formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showMessage(el.authMessage, error.message, 'error');
  }
});

// ---------------------------------------------------------------------
// 5. Déconnexion (le bouton est injecté dynamiquement dans le header).
// ---------------------------------------------------------------------
async function logout() {
  await supabaseClient.auth.signOut();
}

// ---------------------------------------------------------------------
// 6. Espace utilisateur connecté : profil + abonnement + historique.
// ---------------------------------------------------------------------
async function loadDashboard() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const authHeaders = { Authorization: `Bearer ${session.access_token}` };

  try {
    const res = await fetch(`${API_BASE_URL}/api/me`, { headers: authHeaders });
    if (!res.ok) throw new Error('Erreur de chargement du profil.');
    const { profile, subscription } = await res.json();

    el.profileCard.innerHTML = `
      <p><strong>Email :</strong> ${profile.email ?? session.user.email}</p>
      <p><strong>Abonnement :</strong> ${subscription ? subscription.plans.name : 'Aucun (offre gratuite par défaut)'}</p>
    `;
  } catch (err) {
    el.profileCard.innerHTML = `<p class="muted">Erreur : ${err.message}</p>`;
  }

  await loadCreatorProfile(authHeaders);
  await loadRequests(authHeaders);
}

// ---------------------------------------------------------------------
// 6bis. Profil créateur : charge les infos existantes dans le formulaire,
//    et les enregistre quand l'utilisateur soumet. Ce profil est ensuite
//    injecté automatiquement par le serveur dans chaque génération IA.
// ---------------------------------------------------------------------
async function loadCreatorProfile(authHeaders) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/creator-profile`, { headers: authHeaders });
    if (!res.ok) throw new Error('Erreur de chargement du profil créateur.');
    const profile = await res.json();

    if (profile) {
      document.getElementById('profile-niche').value = profile.niche ?? '';
      document.getElementById('profile-audience').value = profile.audience ?? '';
      document.getElementById('profile-tone').value = profile.tone ?? '';
      document.getElementById('profile-style-notes').value = profile.style_notes ?? '';
    }
  } catch (err) {
    showMessage(el.creatorProfileMessage, err.message, 'error');
  }
}

el.formCreatorProfile.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage(el.creatorProfileMessage);

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const niche = document.getElementById('profile-niche').value;
  const audience = document.getElementById('profile-audience').value;
  const tone = document.getElementById('profile-tone').value;
  const style_notes = document.getElementById('profile-style-notes').value;
  const submitButton = el.formCreatorProfile.querySelector('button');

  submitButton.disabled = true;
  submitButton.textContent = 'Enregistrement...';

  try {
    const res = await fetch(`${API_BASE_URL}/api/creator-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ niche, audience, tone, style_notes }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'enregistrement.');

    showMessage(el.creatorProfileMessage, 'Profil enregistré !', 'success');
  } catch (err) {
    showMessage(el.creatorProfileMessage, err.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Enregistrer mon profil';
  }
});

// Regroupe les requêtes plates renvoyées par l'API en conversations
// (mêmes conversation_id), triées de la plus récemment active à la plus
// ancienne.
function groupByConversation(requests) {
  const map = new Map();
  for (const r of requests) {
    const key = r.conversation_id || r.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }

  const threads = Array.from(map.entries()).map(([key, turns]) => {
    const sorted = [...turns].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return {
      conversationId: key,
      requestType: sorted[0].request_type,
      turns: sorted,
      lastCreatedAt: sorted[sorted.length - 1].created_at,
    };
  });

  threads.sort((a, b) => new Date(b.lastCreatedAt) - new Date(a.lastCreatedAt));
  return threads;
}

async function loadRequests(authHeaders) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/ai-requests`, { headers: authHeaders });
    if (!res.ok) throw new Error('Erreur de chargement de l\'historique.');
    const requests = await res.json();

    if (requests.length === 0) {
      el.requestsList.innerHTML = '<p class="muted">Aucune requête pour l\'instant.</p>';
      return;
    }

    const threads = groupByConversation(requests);

    el.requestsList.innerHTML = threads
      .map((thread) => {
        const turnsHtml = thread.turns
          .map(
            (r) => `
            <div class="request-item">
              <span class="badge status-${r.status}">${statusLabel(r.status)}</span>
              <strong>${contentTypeLabel(r.request_type)}</strong>
              <p class="muted">${r.prompt}</p>
              ${r.response ? `<div class="ai-response">${renderAiResponse(r.response)}</div>` : ''}
              ${r.status === 'failed' && r.error_message ? `<p class="muted">Erreur : ${r.error_message}</p>` : ''}
            </div>
          `
          )
          .join('');

        const lastTurn = thread.turns[thread.turns.length - 1];
        const canReply = lastTurn.status === 'completed';

        const replyFormHtml = canReply
          ? `
            <form class="reply-form" data-conversation-id="${thread.conversationId}" data-request-type="${thread.requestType}">
              <input type="text" class="reply-input" placeholder="Répondre dans cette conversation..." required />
              <button type="submit">Répondre</button>
            </form>
          `
          : '';

        return `<div class="thread">${turnsHtml}${replyFormHtml}</div>`;
      })
      .join('');
  } catch (err) {
    el.requestsList.innerHTML = `<p class="muted">Erreur : ${err.message}</p>`;
  }
}

// Envoie un message (nouvelle requête ou réponse dans une conversation) à
// l'API et LIT LA RÉPONSE EN STREAMING : Claude écrit sa réponse petit à
// petit, et onChunk(text) est appelé à chaque morceau reçu, pour un effet
// "en train d'écrire" en direct. Retourne le texte complet une fois fini.
async function streamAiMessage({ request_type, prompt, conversation_id, onChunk }) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) throw new Error('Session expirée, reconnecte-toi.');

  const res = await fetch(`${API_BASE_URL}/api/ai-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ request_type, prompt, conversation_id }),
  });

  if (!res.ok) {
    // Erreur détectée avant le début du streaming (ex: limite de requêtes
    // atteinte) : le serveur renvoie encore du JSON classique ici.
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur lors de l\'envoi.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunkText = decoder.decode(value, { stream: true });
    fullText += chunkText;
    if (onChunk) onChunk(chunkText);
  }

  return fullText;
}

// ---------------------------------------------------------------------
// 7. Envoi d'une nouvelle requête IA (démarre toujours une nouvelle
//    conversation — aucun conversation_id n'est envoyé).
// ---------------------------------------------------------------------
el.formAiRequest.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage(el.aiRequestMessage);

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const request_type = document.getElementById('request-type').value;
  const prompt = document.getElementById('request-prompt').value;
  const submitButton = el.formAiRequest.querySelector('button');

  submitButton.disabled = true;
  submitButton.textContent = 'Génération en cours...';

  el.aiRequestMessage.innerHTML = '<div class="ai-response" id="streaming-preview"></div>';
  const previewEl = document.getElementById('streaming-preview');

  try {
    await streamAiMessage({
      request_type,
      prompt,
      onChunk: (chunkText) => {
        previewEl.textContent += chunkText;
      },
    });

    clearMessage(el.aiRequestMessage);
    showMessage(el.aiRequestMessage, 'Réponse générée !', 'success');
    el.formAiRequest.reset();
    const { data: { session: freshSession } } = await supabaseClient.auth.getSession();
    await loadRequests({ Authorization: `Bearer ${freshSession.access_token}` });
  } catch (err) {
    showMessage(el.aiRequestMessage, err.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Envoyer';
  }
});

// ---------------------------------------------------------------------
// 7bis. Répondre dans une conversation existante. Les formulaires de
//    réponse sont recréés à chaque rendu de l'historique, donc on utilise
//    la délégation d'événements (un seul listener sur le conteneur).
// ---------------------------------------------------------------------
el.requestsList.addEventListener('submit', async (e) => {
  const form = e.target.closest('.reply-form');
  if (!form) return;
  e.preventDefault();

  const conversation_id = form.dataset.conversationId;
  const request_type = form.dataset.requestType;
  const input = form.querySelector('.reply-input');
  const prompt = input.value;
  const submitButton = form.querySelector('button');

  submitButton.disabled = true;
  submitButton.textContent = 'Génération en cours...';

  const previewEl = document.createElement('div');
  previewEl.className = 'ai-response';
  form.insertAdjacentElement('beforebegin', previewEl);

  try {
    await streamAiMessage({
      request_type,
      prompt,
      conversation_id,
      onChunk: (chunkText) => {
        previewEl.textContent += chunkText;
      },
    });
    const { data: { session } } = await supabaseClient.auth.getSession();
    await loadRequests({ Authorization: `Bearer ${session.access_token}` });
  } catch (err) {
    showMessage(el.aiRequestMessage, err.message, 'error');
    submitButton.disabled = false;
    submitButton.textContent = 'Répondre';
    previewEl.remove();
  }
});

// ---------------------------------------------------------------------
// 8. Bascule entre vue publique et tableau de bord selon l'état de
//    connexion.
// ---------------------------------------------------------------------
supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) {
    el.viewPublic.classList.add('hidden');
    el.viewDashboard.classList.remove('hidden');
    el.nav.innerHTML = `
      <span class="muted">${session.user.email}</span>
      <button class="secondary" id="btn-logout">Se déconnecter</button>
    `;
    document.getElementById('btn-logout').addEventListener('click', logout);
    loadDashboard();
  } else {
    el.viewDashboard.classList.add('hidden');
    el.viewPublic.classList.remove('hidden');
    el.nav.innerHTML = '';
  }
});

// Chargement initial des offres publiques (indépendant de la connexion).
loadPlans();
