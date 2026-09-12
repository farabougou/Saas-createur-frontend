// ---------------------------------------------------------------------
// Client Supabase (auth + session), créé une seule fois au chargement.
// ---------------------------------------------------------------------
const supabaseClient = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

const API_BASE_URL = window.APP_CONFIG.API_BASE_URL;

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
  verification_publication: 'Vérification avant publication',
};

function contentTypeLabel(type) {
  return CONTENT_TYPE_LABELS[type] || type;
}

function renderAiResponse(text) {
  if (!text) return '';
  return window.marked.parse(text);
}

// Traduit une erreur technique (souvent un problème réseau) en message
// clair et actionnable pour l'utilisateur, plutôt que d'afficher le
// message brut du navigateur.
function friendlyErrorMessage(err) {
  const msg = err?.message || '';
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Load failed') ||
    msg.includes('fetch failed')
  ) {
    return 'Impossible de contacter le serveur. Vérifie ta connexion internet et réessaie.';
  }
  return msg || 'Une erreur est survenue. Réessaie dans quelques instants.';
}

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
  tiktokCard: document.getElementById('tiktok-card'),
};

let allThreads = [];
let selectedConversationId = null;
let conversationTitles = {};

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
    el.plansGrid.innerHTML = `<p class="muted">Erreur de chargement des offres (${friendlyErrorMessage(err)})</p>`;
  }
}

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

el.formSignup.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  const { error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    showMessage(el.authMessage, friendlyErrorMessage(error), 'error');
    return;
  }

  showMessage(
    el.authMessage,
    'Compte créé ! Si la confirmation par email est activée sur ton projet Supabase, vérifie ta boîte mail avant de te connecter.',
    'success'
  );
});

el.formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showMessage(el.authMessage, friendlyErrorMessage(error), 'error');
  }
});

async function logout() {
  await supabaseClient.auth.signOut();
}

async function loadDashboard() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const authHeaders = { Authorization: `Bearer ${session.access_token}` };

  el.sidebarUserEmail.textContent = session.user.email;

  try {
    const res = await fetch(`${API_BASE_URL}/api/me`, { headers: authHeaders });
    if (!res.ok) throw new Error('Erreur de chargement du profil.');
        const { profile, videos, growth } = await res.json();

    const quotaText = usage.quota != null
      ? `${usage.requestsUsed} / ${usage.quota} requêtes utilisées ce mois`
      : `${usage.requestsUsed} requêtes utilisées ce mois`;

    el.profileCard.innerHTML = `
      <p><strong>Email :</strong> ${profile.email ?? session.user.email}</p>
      <p><strong>Abonnement :</strong> ${subscription ? subscription.plans.name : 'Aucun (offre gratuite par défaut)'}</p>
      <p><strong>Utilisation :</strong> ${quotaText}</p>
    `;
  } catch (err) {
    el.profileCard.innerHTML = `<p class="muted">Erreur : ${friendlyErrorMessage(err)}</p>`;
  }

  await loadCreatorProfile(authHeaders);
  await loadTikTokStatus(authHeaders);
  showHomeScreen();
  await loadRequests(authHeaders);
}

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
    showMessage(el.creatorProfileMessage, friendlyErrorMessage(err), 'error');
  }
}

// --------------------- Connexion TikTok ---------------------

async function loadTikTokStatus(authHeaders) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tiktok/status`, { headers: authHeaders });
    if (!res.ok) throw new Error('Erreur de chargement du statut TikTok.');
    const { connected } = await res.json();

    if (connected) {
      el.tiktokCard.innerHTML = `<p class="muted">Chargement du profil TikTok...</p>`;
      await loadTikTokProfile(authHeaders);
    } else {
      el.tiktokCard.innerHTML = `<button id="btn-connect-tiktok">Connecter mon compte TikTok</button>`;
      document.getElementById('btn-connect-tiktok').addEventListener('click', connectTikTok);
    }
  } catch (err) {
    el.tiktokCard.innerHTML = `<p class="muted">Erreur : ${friendlyErrorMessage(err)}</p>`;
  }
}

async function loadTikTokProfile(authHeaders) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tiktok/profile`, { headers: authHeaders });
    if (!res.ok) throw new Error('Impossible de charger le profil TikTok.');
    const { profile, videos } = await res.json();

    const videosHtml = videos && videos.length
      ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-top:12px;">
          ${videos.map((v) => `
            <div style="position:relative;border-radius:8px;overflow:hidden;">
              <img src="${v.cover_image_url}" alt="${(v.title || 'Vidéo TikTok').replace(/"/g, '&quot;')}" style="width:100%;display:block;aspect-ratio:9/16;object-fit:cover;" />
              <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;padding:2px 4px;">
                👁 ${v.view_count ?? 0}
              </div>
            </div>
          `).join('')}
        </div>
      `
      : `<p class="muted" style="margin-top:8px;">Aucune vidéo publique trouvée.</p>`;

    el.tiktokCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="${profile.avatar_url}" alt="Avatar TikTok" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
                <div style="flex:1;">
          <strong>${profile.display_name || 'Compte TikTok'}</strong>
          <p class="muted" style="margin:0;">✅ Connecté</p>
          <p class="muted" style="margin:2px 0 0;font-size:12px;">
                      <p class="muted" style="margin:2px 0 0;font-size:12px;">
            ${(profile.follower_count ?? 0).toLocaleString('fr-FR')} abonnés · ${(profile.likes_count ?? 0).toLocaleString('fr-FR')} likes · ${profile.video_count ?? 0} vidéos
          </p>
          <p class="muted" style="margin:2px 0 0;font-size:11px;">
            ${growth
              ? `Depuis le ${new Date(growth.sinceDate).toLocaleDateString('fr-FR')} : ${growth.followerDelta >= 0 ? '+' : ''}${growth.followerDelta} abonnés, ${growth.likesDelta >= 0 ? '+' : ''}${growth.likesDelta} likes`
              : 'Le suivi de croissance démarre aujourd\'hui — reviens demain pour voir l\'évolution.'}
          </p>
        </div>
        <button class="secondary" id="btn-disconnect-tiktok">Déconnecter</button>
      </div>
      ${videosHtml}
    `;
    document.getElementById('btn-disconnect-tiktok').addEventListener('click', disconnectTikTok);
  } catch (err) {
    el.tiktokCard.innerHTML = `
      <p>✅ Compte TikTok connecté</p>
      <p class="muted">(Détails indisponibles : ${friendlyErrorMessage(err)})</p>
      <button class="secondary" id="btn-disconnect-tiktok">Déconnecter</button>
    `;
    document.getElementById('btn-disconnect-tiktok').addEventListener('click', disconnectTikTok);
  }
}

async function connectTikTok() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  window.location.href = `${API_BASE_URL}/api/tiktok/auth?token=${encodeURIComponent(session.access_token)}`;
}

async function disconnectTikTok() {
  const confirmed = window.confirm('Déconnecter ton compte TikTok ?');
  if (!confirmed) return;

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/tiktok/disconnect`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok && res.status !== 204) throw new Error('Erreur lors de la déconnexion.');
    await loadTikTokStatus({ Authorization: `Bearer ${session.access_token}` });
  } catch (err) {
    alert(friendlyErrorMessage(err));
  }
}

// --------------------------------------------------------------

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
    showMessage(el.creatorProfileMessage, friendlyErrorMessage(err), 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Enregistrer mon profil';
  }
});

el.btnOpenProfile.addEventListener('click', () => {
  el.profileModal.classList.remove('hidden');
});
el.btnCloseProfile.addEventListener('click', () => {
  el.profileModal.classList.add('hidden');
});
el.profileModal.addEventListener('click', (e) => {
  if (e.target === el.profileModal) el.profileModal.classList.add('hidden');
});

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
    const [requestsRes, titlesRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/ai-requests`, { headers: authHeaders }),
      fetch(`${API_BASE_URL}/api/conversations`, { headers: authHeaders }),
    ]);
    if (!requestsRes.ok) throw new Error('Erreur de chargement de l\'historique.');
    const requests = await requestsRes.json();
    const titles = titlesRes.ok ? await titlesRes.json() : [];

    conversationTitles = {};
    for (const t of titles) {
      conversationTitles[t.conversation_id] = t.title;
    }

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
    el.conversationsList.innerHTML = `<p class="muted" style="padding:10px 12px;">Erreur : ${friendlyErrorMessage(err)}</p>`;
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
      const defaultLabel = firstPrompt.length > 42 ? `${firstPrompt.slice(0, 42)}…` : firstPrompt;
      const label = conversationTitles[thread.conversationId] || defaultLabel;
      const isActive = thread.conversationId === selectedConversationId;
      return `
        <div class="conversation-item ${isActive ? 'active' : ''}" data-conversation-id="${thread.conversationId}">
          <span class="conversation-label"><span class="conv-status-dot status-${lastTurn.status}"></span>${label}</span>
          <span class="conversation-actions">
            <button class="icon-btn btn-rename-conversation" title="Renommer">✏️</button>
            <button class="icon-btn btn-delete-conversation" title="Supprimer">🗑</button>
          </span>
        </div>
      `;
    })
    .join('');
}

el.conversationsList.addEventListener('click', (e) => {
  const item = e.target.closest('.conversation-item');
  if (!item) return;
  const conversationId = item.dataset.conversationId;

  if (e.target.closest('.btn-rename-conversation')) {
    e.stopPropagation();
    renameConversation(conversationId);
    return;
  }
  if (e.target.closest('.btn-delete-conversation')) {
    e.stopPropagation();
    deleteConversation(conversationId);
    return;
  }
  selectConversation(conversationId);
});

async function renameConversation(conversationId) {
  const currentTitle = conversationTitles[conversationId] || '';
  const newTitle = window.prompt('Nouveau nom de la conversation :', currentTitle);
  if (newTitle === null || !newTitle.trim()) return;

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (!res.ok) throw new Error('Erreur lors du renommage.');
    conversationTitles[conversationId] = newTitle.trim();
    renderSidebar();
  } catch (err) {
    alert(friendlyErrorMessage(err));
  }
}

async function deleteConversation(conversationId) {
  const confirmed = window.confirm('Supprimer définitivement cette conversation ?');
  if (!confirmed) return;

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok && res.status !== 204) throw new Error('Erreur lors de la suppression.');

    if (selectedConversationId === conversationId) {
      showHomeScreen();
    }
    const { data: { session: freshSession } } = await supabaseClient.auth.getSession();
    await loadRequests({ Authorization: `Bearer ${freshSession.access_token}` });
  } catch (err) {
    alert(friendlyErrorMessage(err));
  }
}

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
    showMessage(el.aiRequestMessage, friendlyErrorMessage(err), 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Envoyer';
  }
});

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
    showMessage(el.replyMessage, friendlyErrorMessage(err), 'error');
    el.formReply.classList.remove('hidden');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Envoyer';
  }
});

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

// Affiche un message après le retour de la connexion TikTok (succès ou échec)
const tiktokParam = new URLSearchParams(window.location.search).get('tiktok');
if (tiktokParam === 'success') {
  alert('Compte TikTok connecté avec succès !');
  window.history.replaceState({}, '', window.location.pathname);
} else if (tiktokParam === 'error') {
  alert('La connexion TikTok a échoué. Réessaie.');
  window.history.replaceState({}, '', window.location.pathname);
}

loadPlans();
