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

function contentTypeLabel(type) {
  return CONTENT_TYPE_LABELS[type] || type;
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
  formCreatorProfile: document.getElementById('form-creator-profile'),
  creatorProfileMessage: document.getElementById('creator-profile-message'),
  sidebarUserEmail: document.getElementById('sidebar-user-email'),
  btnOpenProfile: document.getElementById('btn-open-profile'),
  btnCloseProfile: document.getElementById('btn-close-profile'),
  profileModal: document.getElementById('profile-modal'),
  btnNewConversation: document.getElementById('btn-new-conversation'),
  conversationsList: document.getElementById('conversations-list'),
  homeScreen: document.getElementById('home-screen'),
  conversationView: document.getElementById('conversation-view'),
  conversationThread: document.getElementById('conversation-thread'),
  formReply: document.getElementById('form-reply'),
  replyInput: document.getElementById('reply-input'),
  replyMessage: document.getElementById('reply-message'),
};

// État : liste des conversations chargées, et laquelle est ouverte.
let allThreads = [];
let selectedConversationId = null;

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
// 6. Espace utilisateur connecté : profil + abonnement + conversations.
// ---------------------------------------------------------------------
async function loadDashboard() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const authHeaders = { Authorization: `Bearer ${session.access_token}` };

  el.sidebarUserEmail.textContent = session.user.email;

  try {
    const res = await fetch(`${API_BASE_URL}/api/me`, { headers: authHeaders });
    if (!res.ok) throw new Error('Erreur de chargement du profil.');
        const { profile, subscription, usage } = await res.json();

    const quotaText = usage.quota != null
      ? `${usage.requestsUsed} / ${usage.quota} requêtes utilisées ce mois`
      : `${usage.requestsUsed} requêtes utilisées ce mois`;

    el.profileCard.innerHTML = `
      <p><strong>Email :</strong> ${profile.email ?? session.user.email}</p>
      <p><strong>Abonnement :</strong> ${subscription ? subscription.plans.name : 'Aucun (offre gratuite par défaut)'}</p>
      <p><strong>Utilisation :</strong> ${quotaText}</p>
    `;
  } catch (err) {
    el.profileCard.innerHTML = `<p class="muted">Erreur : ${err.message}</p>`;
  }

  await loadCreatorProfile(authHeaders);
  showHomeScreen();
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

// Ouvre / ferme la fenêtre Profil & paramètres.
el.btnOpenProfile.addEventListener('click', () => {
  el.profileModal.classList.remove('hidden');
});
el.btnCloseProfile.addEventListener('click', () => {
  el.profileModal.classList.add('hidden');
});
el.profileModal.addEventListener('click', (e) => {
  if (e.target === el.profileModal) el.profileModal.classList.add('hidden');
});

// ---------------------------------------------------------------------
// 6ter. Barre latérale : liste des conversations + navigation entre
//    l'écran d'accueil et une conversation ouverte.
// ---------------------------------------------------------------------

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

    allThreads = groupByConversation(requests);
    renderSidebar();

    if (selectedConversationId) {
      const stillExists = allThreads.some((t) => t.conversationId === selectedConversationId);
      if (stillExists) {
        renderConversationThread();
      } else {
        showHomeScreen();
      }
    }
  } catch (err) {
    el.conversationsList.innerHTML = `<p class="muted" style="padding:10px 12px;">Erreur : ${err.message}</p>`;
  }
}

function renderSidebar() {
  if (allThreads.length === 0) {
    el.conversationsList.innerHTML = '<p class="muted" style="padding:10px 12px;">Aucune conversation.</p>';
    return;
  }

  el.conversationsList.innerHTML = allThreads
    .map((thread) => {
      const lastTurn = thread.turns[thread.turns.length - 1];
      const firstPrompt = thread.turns[0].prompt;
      const label = firstPrompt.length > 42 ? `${firstPrompt.slice(0, 42)}…` : firstPrompt;
      const isActive = thread.conversationId === selectedConversationId;
      return `
        <button class="conversation-item ${isActive ? 'active' : ''}" data-conversation-id="${thread.conversationId}">
          <span class="conv-status-dot status-${lastTurn.status}"></span>${label}
        </button>
      `;
    })
    .join('');
}

el.conversationsList.addEventListener('click', (e) => {
  const btn = e.target.closest('.conversation-item');
  if (!btn) return;
  selectConversation(btn.dataset.conversationId);
});

el.btnNewConversation.addEventListener('click', () => {
  clearMessage(el.aiRequestMessage);
  document.getElementById('request-type').value = '';
  document.getElementById('request-prompt').value = '';
  showHomeScreen();
});

function showHomeScreen() {
  selectedConversationId = null;
  el.conversationView.classList.add('hidden');
  el.homeScreen.classList.remove('hidden');
  renderSidebar();
}

function selectConversation(conversationId) {
  selectedConversationId = conversationId;
  el.homeScreen.classList.add('hidden');
  el.conversationView.classList.remove('hidden');
  renderSidebar();
  renderConversationThread();
}

function renderConversationThread() {
  const thread = allThreads.find((t) => t.conversationId === selectedConversationId);
  if (!thread) return;

  el.conversationThread.innerHTML = thread.turns
    .map(
      (r) => `
      <div class="chat-turn">
        <div class="chat-prompt">${r.prompt}</div>
        ${r.response ? `<div class="ai-response">${renderAiResponse(r.response)}</div>` : ''}
        ${r.status === 'pending' ? '<p class="muted">Génération en cours...</p>' : ''}
        ${r.status === 'failed' && r.error_message ? `<p class="muted">Erreur : ${r.error_message}</p>` : ''}
      </div>
    `
    )
    .join('');

  const lastTurn = thread.turns[thread.turns.length - 1];
  el.formReply.classList.toggle('hidden', lastTurn.status !== 'completed');
}

// ---------------------------------------------------------------------
// 7. Envoi d'un message à Claude, en streaming (le texte arrive petit à
//    petit, comme sur Claude.ai), qu'il s'agisse d'une nouvelle
//    conversation ou d'une réponse dans une conversation existante.
// ---------------------------------------------------------------------
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
// 7bis. Écran d'accueil : démarre toujours une nouvelle conversation.
// ---------------------------------------------------------------------
el.formAiRequest.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage(el.aiRequestMessage);

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const request_type = document.getElementById('request-type').value;
  const prompt = document.getElementById('request-prompt').value;
  const submitButton = el.formAiRequest.querySelector('button');
  const newConversationId = crypto.randomUUID();

  submitButton.disabled = true;
  submitButton.textContent = 'Génération en cours...';

  // On bascule tout de suite sur la vue conversation, avec le texte qui
  // s'affiche au fur et à mesure.
  selectedConversationId = newConversationId;
  el.homeScreen.classList.add('hidden');
  el.conversationView.classList.remove('hidden');
  el.formReply.classList.add('hidden');
  el.conversationThread.innerHTML = `
    <div class="chat-turn">
      <div class="chat-prompt">${prompt}</div>
      <div class="ai-response" id="streaming-preview"></div>
    </div>
  `;
  const previewEl = document.getElementById('streaming-preview');

  try {
    await streamAiMessage({
      request_type,
      prompt,
      conversation_id: newConversationId,
      onChunk: (chunkText) => {
        previewEl.textContent += chunkText;
      },
    });

    el.formAiRequest.reset();
    const { data: { session: freshSession } } = await supabaseClient.auth.getSession();
    await loadRequests({ Authorization: `Bearer ${freshSession.access_token}` });
  } catch (err) {
    showHomeScreen();
    showMessage(el.aiRequestMessage, err.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Envoyer';
  }
});

// ---------------------------------------------------------------------
// 7ter. Répondre dans la conversation actuellement ouverte.
// ---------------------------------------------------------------------
el.formReply.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage(el.replyMessage);
  if (!selectedConversationId) return;

  const thread = allThreads.find((t) => t.conversationId === selectedConversationId);
  if (!thread) return;

  const request_type = thread.requestType;
  const prompt = el.replyInput.value;
  const submitButton = el.formReply.querySelector('button');

  submitButton.disabled = true;
  submitButton.textContent = 'Génération en cours...';
  el.replyInput.value = '';
  el.formReply.classList.add('hidden');

  const previewTurn = document.createElement('div');
  previewTurn.className = 'chat-turn';
  previewTurn.innerHTML = `<div class="chat-prompt">${prompt}</div><div class="ai-response" id="streaming-preview"></div>`;
  el.conversationThread.appendChild(previewTurn);
  const previewEl = previewTurn.querySelector('#streaming-preview');

  try {
    await streamAiMessage({
      request_type,
      prompt,
      conversation_id: selectedConversationId,
      onChunk: (chunkText) => {
        previewEl.textContent += chunkText;
      },
    });

    const { data: { session } } = await supabaseClient.auth.getSession();
    await loadRequests({ Authorization: `Bearer ${session.access_token}` });
  } catch (err) {
    showMessage(el.replyMessage, err.message, 'error');
    el.formReply.classList.remove('hidden');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Envoyer';
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
