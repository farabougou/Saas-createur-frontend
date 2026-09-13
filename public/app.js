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
  analyse_video: 'Analyse de vidéo TikTok',
  generate_from_success: 'Nouveau script inspiré d\'un succès',
  repurpose_content: 'Adaptation multicanal',
};

function contentTypeLabel(type) {
  return CONTENT_TYPE_LABELS[type] || type;
}

function renderAiResponse(text) {
  if (!text) return '';
  return window.marked.parse(text);
}

function escapeHtml(text) {
  return (text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  profileModal: document.getElementById('profile-modal'),
  btnCloseProfile: document.getElementById('btn-close-profile'),
  extraTools: document.getElementById('extra-tools'),
  tiktokCard: document.getElementById('tiktok-card'),
};

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

async function authHeadersOrNull() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
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
    el.profileCard.innerHTML = `<p class="muted">Erreur : ${friendlyErrorMessage(err)}</p>`;
  }

  await loadCreatorProfile(authHeaders);
  await loadTikTokStatus(authHeaders);
  ensureStoryboardUI();
  ensureSponsorshipUI();
  ensurePersonaSectionUI();
  ensurePersonaDropdownUI();
  ensureRepliesUI();
  await loadSponsorships();
  await loadPersonas();
}

// --------------------- Storyboard automatique ---------------------
// Découpe un script narratif complet en plans de ~10 secondes, chacun avec
// sa narration et un prompt visuel prêt à coller dans un générateur vidéo
// IA (Runway, Kling, Luma...), en respectant une "Bible" de cohérence
// (personnages, vêtements, décor) définie par l'utilisateur.

let lastStoryboardScenes = [];

function ensureStoryboardUI() {
  if (document.getElementById('storyboard-section')) return; // déjà injecté

  const section = document.createElement('div');
  section.id = 'storyboard-section';
  section.className = 'card';
  section.style.marginTop = '20px';
  section.innerHTML = `
    <h3 style="margin-top:0;">🎬 Storyboard automatique</h3>
    <p class="muted" style="margin-top:0;">
      Colle ton script complet, décris tes personnages et ton décor dans la Bible, et l'IA découpe tout en plans
      de ~10 secondes avec un prompt visuel prêt pour un générateur vidéo IA.
    </p>
    <label style="display:block;margin-top:10px;font-size:13px;">
      Bible (personnages, vêtements, décor à garder identiques sur tous les plans)
    </label>
    <textarea
      id="storyboard-bible"
      rows="3"
      placeholder="Ex : Aïcha, 28 ans, tresses noires, boubou jaune. Dans un salon africain chaleureux, tissus wax aux murs, lumière d'après-midi."
      style="width:100%;margin-top:4px;"
    ></textarea>
    <label style="display:block;margin-top:10px;font-size:13px;">Script complet</label>
    <textarea
      id="storyboard-script"
      rows="6"
      placeholder="Colle ici le texte complet de ta narration..."
      style="width:100%;margin-top:4px;"
    ></textarea>
    <button id="btn-generate-storyboard" style="margin-top:10px;">Générer le storyboard</button>
    <div id="storyboard-message"></div>
    <div id="storyboard-results" style="margin-top:16px;display:grid;gap:12px;"></div>
  `;

  el.extraTools.appendChild(section);
  document.getElementById('btn-generate-storyboard').addEventListener('click', generateStoryboard);
}

async function generateStoryboard() {
  const bible = document.getElementById('storyboard-bible').value;
  const script = document.getElementById('storyboard-script').value;
  const messageEl = document.getElementById('storyboard-message');
  const resultsEl = document.getElementById('storyboard-results');
  const btn = document.getElementById('btn-generate-storyboard');

  clearMessage(messageEl);
  resultsEl.innerHTML = '';

  if (!script.trim()) {
    showMessage(messageEl, 'Le script est requis.', 'error');
    return;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  btn.disabled = true;
  btn.textContent = 'Découpage en cours...';

  try {
    const res = await fetch(`${API_BASE_URL}/api/storyboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ script, bible }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération du storyboard.');

    lastStoryboardScenes = data.scenes || [];
    renderStoryboard(lastStoryboardScenes);
  } catch (err) {
    showMessage(messageEl, friendlyErrorMessage(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Générer le storyboard';
  }
}

function renderStoryboard(scenes) {
  const resultsEl = document.getElementById('storyboard-results');

  if (!scenes.length) {
    resultsEl.innerHTML = '<p class="muted">Aucune scène générée.</p>';
    return;
  }

  resultsEl.innerHTML = scenes
    .map(
      (s, i) => `
      <div class="card" style="background:rgba(255,255,255,0.03);">
        <strong>Plan ${s.scene_number ?? i + 1}</strong>
        <span class="muted" style="font-size:12px;"> · ~${s.duration_seconds ?? 10}s</span>

        <p style="margin:8px 0 4px;font-size:13px;"><strong>Narration (voix off) :</strong></p>
        <p style="margin:0 0 8px;white-space:pre-wrap;">${escapeHtml(s.narration)}</p>
        <button class="secondary btn-copy-narration" data-index="${i}" style="font-size:12px;">📋 Copier la narration</button>

        <p style="margin:12px 0 4px;font-size:13px;"><strong>Prompt visuel (pour le générateur vidéo) :</strong></p>
        <p style="margin:0 0 8px;white-space:pre-wrap;font-family:monospace;font-size:12px;background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;">${escapeHtml(s.visual_prompt)}</p>
        <button class="secondary btn-copy-prompt" data-index="${i}" style="font-size:12px;">📋 Copier le prompt visuel</button>
      </div>
    `
    )
    .join('');

  resultsEl.querySelectorAll('.btn-copy-narration').forEach((copyBtn) => {
    copyBtn.addEventListener('click', () => {
      const scene = scenes[Number(copyBtn.dataset.index)];
      navigator.clipboard.writeText(scene?.narration || '');
      const original = copyBtn.textContent;
      copyBtn.textContent = '✅ Copié !';
      setTimeout(() => { copyBtn.textContent = original; }, 1500);
    });
  });

  resultsEl.querySelectorAll('.btn-copy-prompt').forEach((copyBtn) => {
    copyBtn.addEventListener('click', () => {
      const scene = scenes[Number(copyBtn.dataset.index)];
      navigator.clipboard.writeText(scene?.visual_prompt || '');
      const original = copyBtn.textContent;
      copyBtn.textContent = '✅ Copié !';
      setTimeout(() => { copyBtn.textContent = original; }, 1500);
    });
  });
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

// --------------------- Connexion TikTok (tuile "Statistiques Récentes") ---------------------

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
    const { profile, videos, growth, recentGrowth } = await res.json();

    // Bannière "depuis hier" : c'est ce qui donne une raison concrète de
    // revenir voir l'app régulièrement. La ligne "depuis le tout début" reste
    // affichée en plus petit, seulement si elle apporte une info différente.
    let growthHtml;
    if (!recentGrowth) {
      growthHtml = `
        <p class="muted" style="margin:2px 0 0;font-size:11px;">
          Le suivi de croissance démarre aujourd'hui — reviens demain pour voir l'évolution.
        </p>
      `;
    } else {
      const recentLine = `Depuis hier : ${recentGrowth.followerDelta >= 0 ? '+' : ''}${recentGrowth.followerDelta} abonnés, ${recentGrowth.likesDelta >= 0 ? '+' : ''}${recentGrowth.likesDelta} likes`;
      const longTermLine = growth && growth.sinceDate !== recentGrowth.sinceDate
        ? `
          <p class="muted" style="margin:2px 0 0;font-size:10px;">
            Depuis le ${new Date(growth.sinceDate).toLocaleDateString('fr-FR')} : ${growth.followerDelta >= 0 ? '+' : ''}${growth.followerDelta} abonnés, ${growth.likesDelta >= 0 ? '+' : ''}${growth.likesDelta} likes
          </p>
        `
        : '';
      growthHtml = `
        <p style="margin:6px 0 0;font-size:12px;background:rgba(99,102,241,0.15);border-radius:6px;padding:4px 8px;display:inline-block;">
          📈 ${recentLine}
        </p>
        ${longTermLine}
      `;
    }

    const videosHtml = videos && videos.length
      ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-top:12px;">
          ${videos.map((v) => `
            <div style="position:relative;border-radius:8px;overflow:hidden;">
              <img src="${v.cover_image_url}" alt="${(v.title || 'Vidéo TikTok').replace(/"/g, '&quot;')}" style="width:100%;display:block;aspect-ratio:9/16;object-fit:cover;" />
              <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;padding:2px 4px;">
                👁 ${v.view_count ?? 0}
              </div>
              <button
                class="btn-analyse-video"
                data-title="${(v.title || 'Sans titre').replace(/"/g, '&quot;')}"
                data-views="${v.view_count ?? 0}"
                data-likes="${v.like_count ?? 0}"
                data-comments="${v.comment_count ?? 0}"
                data-shares="${v.share_count ?? 0}"
                data-url="${(v.share_url || '').replace(/"/g, '&quot;')}"
                title="Analyser cette vidéo"
                style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.65);color:#fff;border:none;border-radius:4px;font-size:13px;line-height:1;padding:4px 6px;cursor:pointer;"
              >🔍</button>
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
            ${(profile.follower_count ?? 0).toLocaleString('fr-FR')} abonnés · ${(profile.likes_count ?? 0).toLocaleString('fr-FR')} likes · ${profile.video_count ?? 0} vidéos
          </p>
          ${growthHtml}
        </div>
        <button class="secondary" id="btn-disconnect-tiktok">Déconnecter</button>
      </div>
      ${videosHtml}
    `;
    document.getElementById('btn-disconnect-tiktok').addEventListener('click', disconnectTikTok);

    // Bouton "🔍" sous chaque vignette : lance une analyse IA de cette
    // vidéo précise, avec son titre et ses statistiques déjà remplis.
    document.querySelectorAll('.btn-analyse-video').forEach((btn) => {
      btn.addEventListener('click', () => {
        const { title, views, likes, comments, shares, url } = btn.dataset;
        const prompt = `Analyse cette vidéo TikTok :\n- Titre : "${title}"\n- Vues : ${views}\n- Likes : ${likes}\n- Commentaires : ${comments}\n- Partages : ${shares}`;
        runGeneration('analyse_video', prompt, { video_url: url, views: Number(views) || 0, likes: Number(likes) || 0 });
      });
    });
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

el.profileModal.addEventListener('click', (e) => {
  if (e.target === el.profileModal) el.profileModal.classList.add('hidden');
});
el.btnCloseProfile.addEventListener('click', () => {
  el.profileModal.classList.add('hidden');
});

// --------------------- Génération de contenu (modales) ---------------------
// Toute génération (script principal, "générer à partir d'un succès",
// recyclage multicanal) s'affiche désormais dans une modale de résultat
// générique, plutôt que dans un fil de conversation. Les boutons d'action
// (CTA après une analyse vidéo, recyclage vers une autre plateforme) sont
// ajoutés dynamiquement sous le résultat, à partir des en-têtes
// X-Analysis-Id / X-Request-Id renvoyés par le serveur.

// Envoie une requête POST en streaming vers n'importe quelle route du
// backend qui répond en texte brut morceau par morceau, et renvoie le texte
// complet une fois terminé, ainsi que les éventuels en-têtes X-Analysis-Id
// et X-Request-Id.
async function streamFromEndpoint(endpoint, body, onChunk) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) throw new Error('Session expirée, reconnecte-toi.');

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur lors de l\'envoi.');
  }

  const analysisId = res.headers.get('X-Analysis-Id');
  const requestId = res.headers.get('X-Request-Id');

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

  return { fullText, analysisId, requestId };
}

async function streamAiMessage({ request_type, prompt, video_url, views, likes, persona_id, onChunk }) {
  return streamFromEndpoint('/api/ai-requests', { request_type, prompt, video_url, views, likes, persona_id }, onChunk);
}

function openResultModal(title, prompt) {
  document.getElementById('result-modal-title').textContent = title;
  document.getElementById('result-prompt').textContent = prompt || '';
  document.getElementById('result-content').textContent = '';
  document.getElementById('result-actions').innerHTML = '';
  document.getElementById('result-modal').classList.remove('hidden');
}

function renderResultActions({ requestType, analysisId, requestId, response }) {
  const actionsEl = document.getElementById('result-actions');
  actionsEl.innerHTML = '';
  if (!response) return;

  // Actions rapides sous un rapport d'analyse de vidéo TikTok terminé :
  // permet de réutiliser ce qui a marché pour générer un nouveau script.
  if (requestType === 'analyse_video' && analysisId) {
    const actionLabels = {
      episode2: "Générer l'épisode 2",
      spinoff: 'Créer un spin-off sur le même ton',
      apply_format: 'Appliquer ce format à une autre histoire',
    };
    Object.entries(actionLabels).forEach(([action, label]) => {
      const btn = document.createElement('button');
      btn.className = 'secondary';
      btn.textContent = label;
      btn.addEventListener('click', () => runGenerateFromSuccess(analysisId, action, label));
      actionsEl.appendChild(btn);
    });
  }

  // Boutons "recyclage multicanal" sous n'importe quel script terminé.
  if (requestId) {
    const twitterBtn = document.createElement('button');
    twitterBtn.className = 'secondary';
    twitterBtn.textContent = '🔁 Adapter en Thread Twitter';
    twitterBtn.addEventListener('click', () => runRepurpose(requestId, 'Twitter_Thread'));
    actionsEl.appendChild(twitterBtn);

    const linkedinBtn = document.createElement('button');
    linkedinBtn.className = 'secondary';
    linkedinBtn.textContent = '🔁 Adapter en Post LinkedIn';
    linkedinBtn.addEventListener('click', () => runRepurpose(requestId, 'LinkedIn_Post'));
    actionsEl.appendChild(linkedinBtn);
  }
}

// Lance une nouvelle génération IA (formulaire principal, ou bouton
// "Analyser cette vidéo" sur une vignette TikTok) et affiche le résultat
// dans la modale de résultat. `extra` peut contenir { video_url, views,
// likes, persona_id }. Renvoie true en cas de succès.
async function runGeneration(request_type, prompt, extra = {}) {
  openResultModal(contentTypeLabel(request_type), prompt);
  const contentEl = document.getElementById('result-content');

  try {
    const { fullText, analysisId, requestId } = await streamAiMessage({
      request_type,
      prompt,
      ...extra,
      onChunk: (chunkText) => {
        contentEl.textContent += chunkText;
      },
    });

    contentEl.innerHTML = renderAiResponse(fullText);
    renderResultActions({ requestType: request_type, analysisId, requestId, response: fullText });
    return true;
  } catch (err) {
    contentEl.innerHTML = `<div class="message error">${friendlyErrorMessage(err)}</div>`;
    return false;
  }
}

// Déclenché par un des 3 boutons d'action rapide sous un rapport d'analyse
// de vidéo TikTok : génère un nouveau script qui réutilise ce qui a fait le
// succès de la vidéo analysée.
async function runGenerateFromSuccess(analysisId, action, displayPrompt) {
  openResultModal(contentTypeLabel('generate_from_success'), displayPrompt);
  const contentEl = document.getElementById('result-content');

  try {
    const { fullText, requestId } = await streamFromEndpoint(
      '/api/generate-from-success',
      { analysis_id: analysisId, action },
      (chunkText) => {
        contentEl.textContent += chunkText;
      }
    );

    contentEl.innerHTML = renderAiResponse(fullText);
    renderResultActions({ requestType: 'generate_from_success', requestId, response: fullText });
  } catch (err) {
    contentEl.innerHTML = `<div class="message error">${friendlyErrorMessage(err)}</div>`;
  }
}

const REPURPOSE_PLATFORM_LABELS = {
  Twitter_Thread: 'Thread Twitter/X',
  LinkedIn_Post: 'Post LinkedIn',
};

// Déclenché par un bouton "🔁 Adapter en ..." sous un script terminé, ou
// depuis la modale "Choisis un script à adapter" : adapte nativement ce
// script à la plateforme choisie, en conservant son ton d'origine.
async function runRepurpose(scriptId, platform) {
  const platformLabel = REPURPOSE_PLATFORM_LABELS[platform] || platform;
  openResultModal(platformLabel, `Adaptation : ${platformLabel}`);
  const contentEl = document.getElementById('result-content');

  try {
    const { fullText, requestId } = await streamFromEndpoint(
      '/api/repurpose-content',
      { script_id: scriptId, platform },
      (chunkText) => {
        contentEl.textContent += chunkText;
      }
    );

    contentEl.innerHTML = renderAiResponse(fullText);
    renderResultActions({ requestType: 'repurpose_content', requestId, response: fullText });
  } catch (err) {
    contentEl.innerHTML = `<div class="message error">${friendlyErrorMessage(err)}</div>`;
  }
}

document.getElementById('btn-close-result').addEventListener('click', () => {
  document.getElementById('result-modal').classList.add('hidden');
});
document.getElementById('result-modal').addEventListener('click', (e) => {
  if (e.target.id === 'result-modal') document.getElementById('result-modal').classList.add('hidden');
});
document.getElementById('btn-copy-result').addEventListener('click', () => {
  const text = document.getElementById('result-content').innerText;
  navigator.clipboard.writeText(text);
  const btn = document.getElementById('btn-copy-result');
  const original = btn.textContent;
  btn.textContent = '✅ Copié !';
  setTimeout(() => { btn.textContent = original; }, 1500);
});

// --------------------- Modale "Créer un script" ---------------------

document.getElementById('btn-quick-create-script').addEventListener('click', () => {
  document.getElementById('create-script-modal').classList.remove('hidden');
});
document.getElementById('btn-close-create-script').addEventListener('click', () => {
  document.getElementById('create-script-modal').classList.add('hidden');
});
document.getElementById('create-script-modal').addEventListener('click', (e) => {
  if (e.target.id === 'create-script-modal') document.getElementById('create-script-modal').classList.add('hidden');
});

el.formAiRequest.addEventListener('submit', async (e) => {
  e.preventDefault();

  const request_type = document.getElementById('request-type').value;
  const prompt = document.getElementById('request-prompt').value;
  const personaSelect = document.getElementById('persona-select');
  const persona_id = personaSelect && personaSelect.value ? personaSelect.value : undefined;
  const submitButton = el.formAiRequest.querySelector('button');

  submitButton.disabled = true;
  submitButton.textContent = 'Génération en cours...';

  document.getElementById('create-script-modal').classList.add('hidden');
  const success = await runGeneration(request_type, prompt, persona_id ? { persona_id } : {});
  if (success) {
    el.formAiRequest.reset();
  }

  submitButton.disabled = false;
  submitButton.textContent = 'Envoyer';
});

// --------------------- Modale "Choisir un script à recycler" ---------------------
// Déclenchée par l'action rapide "🔁 Transformer en Thread" : liste les
// scripts déjà générés et terminés, pour en choisir un à adapter.

document.getElementById('btn-quick-repurpose').addEventListener('click', openRepurposePicker);
document.getElementById('btn-close-repurpose-picker').addEventListener('click', () => {
  document.getElementById('repurpose-picker-modal').classList.add('hidden');
});
document.getElementById('repurpose-picker-modal').addEventListener('click', (e) => {
  if (e.target.id === 'repurpose-picker-modal') document.getElementById('repurpose-picker-modal').classList.add('hidden');
});

async function openRepurposePicker() {
  const modal = document.getElementById('repurpose-picker-modal');
  const listEl = document.getElementById('repurpose-picker-list');
  listEl.innerHTML = '<p class="muted">Chargement...</p>';
  modal.classList.remove('hidden');

  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/ai-requests`, { headers });
    if (!res.ok) throw new Error('Erreur de chargement.');
    const requests = await res.json();
    const completed = requests.filter((r) => r.status === 'completed' && r.response);

    if (!completed.length) {
      listEl.innerHTML = '<p class="muted">Aucun script terminé pour le moment. Crée d\'abord un script avec « Créer un script ».</p>';
      return;
    }

    listEl.innerHTML = completed
      .slice(0, 20)
      .map((r) => {
        const label = r.prompt.length > 60 ? `${r.prompt.slice(0, 60)}…` : r.prompt;
        const date = new Date(r.created_at).toLocaleDateString('fr-FR');
        return `
          <div class="card" style="background:rgba(255,255,255,0.03);padding:10px;font-size:13px;">
            <p style="margin:0 0 6px;"><strong>${contentTypeLabel(r.request_type)}</strong> <span class="muted" style="font-size:11px;">· ${date}</span></p>
            <p class="muted" style="margin:0 0 8px;">${escapeHtml(label)}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="secondary btn-picker-repurpose" data-id="${r.id}" data-platform="Twitter_Thread" style="font-size:12px;">🔁 Thread Twitter</button>
              <button class="secondary btn-picker-repurpose" data-id="${r.id}" data-platform="LinkedIn_Post" style="font-size:12px;">🔁 Post LinkedIn</button>
            </div>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.btn-picker-repurpose').forEach((btn) => {
      btn.addEventListener('click', () => {
        modal.classList.add('hidden');
        runRepurpose(btn.dataset.id, btn.dataset.platform);
      });
    });
  } catch (err) {
    listEl.innerHTML = `<p class="muted">Erreur : ${friendlyErrorMessage(err)}</p>`;
  }
}

// --------------------- Action rapide "Générer l'Audio" ---------------------
// Pas de fournisseur de synthèse vocale (TTS) branché pour l'instant : on
// est honnête là-dessus plutôt que d'afficher un bouton qui ne fait rien.

document.getElementById('btn-quick-audio').addEventListener('click', () => {
  alert(
    "🔊 La génération audio n'est pas encore branchée : il faudrait d'abord connecter un service de synthèse vocale (ex : ElevenLabs). Dis-moi si tu veux que je l'ajoute, et je m'en occupe !"
  );
});

// --------------------- Tuile "Radar" (tendances) ---------------------
// Recherche à la demande (bouton "Actualiser"), pas automatique, pour ne
// pas consommer une recherche web à chaque ouverture du tableau de bord.

document.getElementById('btn-refresh-radar').addEventListener('click', loadRadar);

async function loadRadar() {
  const contentEl = document.getElementById('radar-content');
  const btn = document.getElementById('btn-refresh-radar');

  contentEl.innerHTML = '<p class="muted">Recherche des tendances en cours...</p>';
  btn.disabled = true;
  btn.textContent = 'Recherche...';

  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/trending-topics`, { method: 'POST', headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la recherche des tendances.');

    contentEl.innerHTML = renderAiResponse(data.markdown);
  } catch (err) {
    contentEl.innerHTML = `<div class="message error">${friendlyErrorMessage(err)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Actualiser';
  }
}

// --------------------- Tuile "Mes Personnages" (avatars) ---------------------

const AVATAR_COLORS = ['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];

function avatarColorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function renderPersonasTile() {
  const tileEl = document.getElementById('personas-tile-list');
  if (!tileEl) return;

  if (!allPersonas.length) {
    tileEl.innerHTML = '<p class="muted" style="font-size:12px;">Aucun persona pour l\'instant. Clique sur « Gérer » pour en créer un.</p>';
    return;
  }

  tileEl.innerHTML = allPersonas
    .slice(0, 8)
    .map((p) => {
      const name = p.name || '?';
      const initial = name.trim().charAt(0).toUpperCase();
      const color = avatarColorForName(name);
      const shortName = name.length > 10 ? `${name.slice(0, 9)}…` : name;
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:56px;" title="${escapeHtml(name)}">
          <div style="width:40px;height:40px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0;">${initial}</div>
          <span style="font-size:10px;text-align:center;line-height:1.2;" class="muted">${escapeHtml(shortName)}</span>
        </div>
      `;
    })
    .join('');
}

document.getElementById('btn-manage-personas').addEventListener('click', () => {
  document.getElementById('persona-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// --------------------- Sponsoring (mini-CRM) ---------------------
// Suivi des prospects de marque sous forme de Kanban (À contacter / En
// négociation / Signé), avec génération d'un email de démarchage basé sur
// les vraies statistiques d'une vidéo performante rattachée à la carte.

let allSponsorships = [];
let availableAnalysesForLinking = [];

const SPONSOR_STATUS_LABELS = {
  a_contacter: 'À contacter',
  en_negociation: 'En négociation',
  signe: 'Signé',
};
const SPONSOR_STATUS_ORDER = ['a_contacter', 'en_negociation', 'signe'];

function ensureSponsorshipUI() {
  if (document.getElementById('sponsorship-section')) return; // déjà injecté

  const section = document.createElement('div');
  section.id = 'sponsorship-section';
  section.className = 'card';
  section.style.marginTop = '20px';
  section.innerHTML = `
    <h3 style="margin-top:0;">🤝 Sponsoring (mini-CRM)</h3>
    <p class="muted" style="margin-top:0;">
      Suis tes prospects de marque et génère un email de démarchage basé sur les vraies statistiques
      d'une de tes vidéos performantes.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;">
      <input id="sponsor-brand-name" placeholder="Nom de la marque" style="flex:1;min-width:140px;" />
      <input id="sponsor-contact-email" placeholder="Email de contact (optionnel)" style="flex:1;min-width:140px;" />
      <button id="btn-add-sponsor">+ Ajouter</button>
    </div>
    <div id="sponsor-message"></div>
    <div id="sponsor-kanban" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px;"></div>
  `;

  el.extraTools.appendChild(section);
  document.getElementById('btn-add-sponsor').addEventListener('click', addSponsorship);
  ensureSponsorPitchModal();
}

function ensureSponsorPitchModal() {
  if (document.getElementById('sponsor-pitch-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'sponsor-pitch-modal';
  modal.style.cssText =
    'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:#1a1a2e;border-radius:12px;padding:20px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto;">
      <h3 style="margin-top:0;">✉️ Pitch de sponsoring généré</h3>
      <div id="sponsor-pitch-text" style="white-space:pre-wrap;font-size:14px;line-height:1.5;background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:12px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="secondary" id="btn-close-pitch-modal">Fermer</button>
        <button id="btn-copy-pitch">📋 Copier l'email</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btn-close-pitch-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
  document.getElementById('btn-copy-pitch').addEventListener('click', () => {
    const text = document.getElementById('sponsor-pitch-text').textContent;
    navigator.clipboard.writeText(text);
    const copyBtn = document.getElementById('btn-copy-pitch');
    const original = copyBtn.textContent;
    copyBtn.textContent = '✅ Copié !';
    setTimeout(() => { copyBtn.textContent = original; }, 1500);
  });
}

function showSponsorPitchModal(pitchText) {
  ensureSponsorPitchModal();
  document.getElementById('sponsor-pitch-text').textContent = pitchText;
  document.getElementById('sponsor-pitch-modal').style.display = 'flex';
}

async function loadSponsorships() {
  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const [sponsorsRes, analysesRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/sponsorships`, { headers }),
      fetch(`${API_BASE_URL}/api/tiktok/analyses`, { headers }),
    ]);
    if (!sponsorsRes.ok) throw new Error('Erreur de chargement des prospects.');

    allSponsorships = await sponsorsRes.json();
    availableAnalysesForLinking = analysesRes.ok ? await analysesRes.json() : [];
    renderSponsorKanban();
  } catch (err) {
    const kanbanEl = document.getElementById('sponsor-kanban');
    if (kanbanEl) kanbanEl.innerHTML = `<p class="muted">Erreur : ${friendlyErrorMessage(err)}</p>`;
  }
}

function renderSponsorKanban() {
  const kanbanEl = document.getElementById('sponsor-kanban');
  if (!kanbanEl) return;

  kanbanEl.innerHTML = SPONSOR_STATUS_ORDER
    .map((statusKey) => {
      const cards = allSponsorships.filter((s) => s.status === statusKey);
      return `
        <div>
          <h4 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;">
            ${SPONSOR_STATUS_LABELS[statusKey]} <span class="muted">(${cards.length})</span>
          </h4>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${cards.map((s) => renderSponsorCard(s, statusKey)).join('') || '<p class="muted" style="font-size:12px;">Aucune marque ici.</p>'}
          </div>
        </div>
      `;
    })
    .join('');

  attachSponsorCardListeners();
}

function renderSponsorCard(s, statusKey) {
  const video = s.linked_video;
  const videoBadge = video
    ? `<p class="muted" style="font-size:11px;margin:4px 0;">🎥 ${(video.views ?? 0).toLocaleString('fr-FR')} vues · ${video.engagement_rate != null ? video.engagement_rate + '% engagement' : 'engagement inconnu'}</p>`
    : `<p class="muted" style="font-size:11px;margin:4px 0;">Aucune vidéo rattachée</p>`;

  const currentIndex = SPONSOR_STATUS_ORDER.indexOf(statusKey);
  const canMovePrev = currentIndex > 0;
  const canMoveNext = currentIndex < SPONSOR_STATUS_ORDER.length - 1;

  const videoOptions = availableAnalysesForLinking
    .map(
      (a) =>
        `<option value="${a.id}" ${s.linked_video_id === a.id ? 'selected' : ''}>Vidéo ${a.id.slice(0, 8)}… (${a.views ?? 0} vues)</option>`
    )
    .join('');

  return `
    <div class="card" style="background:rgba(255,255,255,0.03);padding:10px;font-size:13px;" data-id="${s.id}">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:6px;">
        <strong>${escapeHtml(s.brand_name)}</strong>
        <button class="icon-btn btn-delete-sponsor" title="Supprimer" data-id="${s.id}">🗑</button>
      </div>
      <p class="muted" style="font-size:11px;margin:4px 0;">${s.contact_email ? escapeHtml(s.contact_email) : 'Pas d\'email renseigné'}</p>
      ${videoBadge}
      <select class="sponsor-video-select" data-id="${s.id}" style="width:100%;font-size:11px;margin:4px 0;">
        <option value="">Rattacher une vidéo performante...</option>
        ${videoOptions}
      </select>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center;">
        ${canMovePrev ? `<button class="secondary btn-move-sponsor" data-id="${s.id}" data-direction="prev" style="font-size:11px;">←</button>` : ''}
        ${canMoveNext ? `<button class="secondary btn-move-sponsor" data-id="${s.id}" data-direction="next" style="font-size:11px;">→</button>` : ''}
        <button class="btn-generate-pitch" data-id="${s.id}" style="font-size:11px;margin-left:auto;">✉️ Générer mon Pitch</button>
      </div>
    </div>
  `;
}

function attachSponsorCardListeners() {
  const kanbanEl = document.getElementById('sponsor-kanban');
  if (!kanbanEl) return;

  kanbanEl.querySelectorAll('.btn-delete-sponsor').forEach((btn) => {
    btn.addEventListener('click', () => deleteSponsorship(btn.dataset.id));
  });
  kanbanEl.querySelectorAll('.btn-move-sponsor').forEach((btn) => {
    btn.addEventListener('click', () => moveSponsorship(btn.dataset.id, btn.dataset.direction));
  });
  kanbanEl.querySelectorAll('.sponsor-video-select').forEach((select) => {
    select.addEventListener('change', () => linkVideoToSponsorship(select.dataset.id, select.value));
  });
  kanbanEl.querySelectorAll('.btn-generate-pitch').forEach((btn) => {
    btn.addEventListener('click', () => generateSponsorPitch(btn.dataset.id, btn));
  });
}

async function addSponsorship() {
  const brandInput = document.getElementById('sponsor-brand-name');
  const emailInput = document.getElementById('sponsor-contact-email');
  const messageEl = document.getElementById('sponsor-message');
  clearMessage(messageEl);

  const brand_name = brandInput.value.trim();
  if (!brand_name) {
    showMessage(messageEl, 'Le nom de la marque est requis.', 'error');
    return;
  }

  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/sponsorships`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ brand_name, contact_email: emailInput.value.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'ajout.');

    brandInput.value = '';
    emailInput.value = '';
    await loadSponsorships();
  } catch (err) {
    showMessage(messageEl, friendlyErrorMessage(err), 'error');
  }
}

async function deleteSponsorship(id) {
  const confirmed = window.confirm('Supprimer ce prospect ?');
  if (!confirmed) return;

  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/sponsorships/${id}`, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 204) throw new Error('Erreur lors de la suppression.');
    await loadSponsorships();
  } catch (err) {
    alert(friendlyErrorMessage(err));
  }
}

async function moveSponsorship(id, direction) {
  const sponsor = allSponsorships.find((s) => s.id === id);
  if (!sponsor) return;

  const currentIndex = SPONSOR_STATUS_ORDER.indexOf(sponsor.status);
  const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
  if (newIndex < 0 || newIndex >= SPONSOR_STATUS_ORDER.length) return;

  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/sponsorships/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: SPONSOR_STATUS_ORDER[newIndex] }),
    });
    if (!res.ok) throw new Error('Erreur lors du changement de statut.');
    await loadSponsorships();
  } catch (err) {
    alert(friendlyErrorMessage(err));
  }
}

async function linkVideoToSponsorship(id, videoId) {
  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/sponsorships/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ linked_video_id: videoId || null }),
    });
    if (!res.ok) throw new Error('Erreur lors du rattachement de la vidéo.');
    await loadSponsorships();
  } catch (err) {
    alert(friendlyErrorMessage(err));
  }
}

async function generateSponsorPitch(id, btn) {
  const headers = await authHeadersOrNull();
  if (!headers) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Génération...';

  try {
    const res = await fetch(`${API_BASE_URL}/api/generate-sponsor-pitch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sponsorship_id: id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération du pitch.');

    showSponsorPitchModal(data.pitch);
  } catch (err) {
    alert(friendlyErrorMessage(err));
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// --------------------- Personas (Moteur de personnalités) ---------------------
// Voix/personnages réutilisables (ton, vocabulaire, mots interdits,
// instructions) qu'on peut choisir dans un menu déroulant avant de générer
// du contenu, pour que l'IA écrive avec une voix précise plutôt que
// générique. Peuvent être créés à la main, ou extraits automatiquement à
// partir d'un script déjà écrit dans le style à reproduire.

let allPersonas = [];

function ensurePersonaSectionUI() {
  if (document.getElementById('persona-section')) return; // déjà injecté

  const section = document.createElement('div');
  section.id = 'persona-section';
  section.className = 'card';
  section.style.marginTop = '20px';
  section.innerHTML = `
    <h3 style="margin-top:0;">🎭 Mes Voix &amp; Personnages</h3>
    <p class="muted" style="margin-top:0;">
      Crée des personas (ton, vocabulaire, mots interdits) pour que l'IA écrive avec une voix précise et cohérente
      au lieu d'une voix générique. Choisis-en un dans le menu déroulant de la modale « Créer un script », avant de générer du contenu.
    </p>

    <details style="margin:10px 0;">
      <summary style="cursor:pointer;font-size:13px;">🧬 Extraire un persona à partir d'un script existant</summary>
      <div style="margin-top:8px;">
        <textarea id="persona-extract-script" rows="5" placeholder="Colle ici un script ou une transcription déjà écrite dans le style à reproduire..." style="width:100%;"></textarea>
        <button id="btn-extract-persona" style="margin-top:6px;">Analyser le style</button>
      </div>
    </details>

    <div id="persona-message"></div>

    <div style="display:grid;gap:8px;margin:12px 0;">
      <input id="persona-name" placeholder="Nom (ex : Le Conteur Historique)" />
      <input id="persona-tone" placeholder="Ton de voix (ex : cynique, phrases courtes, ironique)" />
      <input id="persona-vocabulary" placeholder="Vocabulaire / expressions récurrentes (optionnel)" />
      <input id="persona-forbidden" placeholder="Mots interdits, clichés à éviter (optionnel)" />
      <textarea id="persona-instructions" rows="2" placeholder="Instructions spécifiques supplémentaires (optionnel)"></textarea>
      <button id="btn-save-persona">💾 Enregistrer ce persona</button>
    </div>

    <div id="persona-list" style="display:grid;gap:8px;"></div>
  `;

  el.extraTools.appendChild(section);
  document.getElementById('btn-extract-persona').addEventListener('click', extractPersonaFromScript);
  document.getElementById('btn-save-persona').addEventListener('click', savePersona);
}

function ensurePersonaDropdownUI() {
  if (document.getElementById('persona-select')) return; // déjà injecté

  const submitButton = el.formAiRequest.querySelector('button');
  if (!submitButton) return;

  const wrapper = document.createElement('div');
  wrapper.style.margin = '10px 0';
  wrapper.innerHTML = `
    <label style="display:block;font-size:13px;margin-bottom:4px;">Voix / Personnage à utiliser</label>
    <select id="persona-select" style="width:100%;">
      <option value="">Standard (par défaut)</option>
    </select>
  `;
  submitButton.parentNode.insertBefore(wrapper, submitButton);
}

async function loadPersonas() {
  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/personas`, { headers });
    if (!res.ok) throw new Error('Erreur de chargement des personas.');
    allPersonas = await res.json();
    renderPersonaList();
    renderPersonaDropdownOptions();
    renderRepliesPersonaOptions();
    renderPersonasTile();
  } catch (err) {
    const listEl = document.getElementById('persona-list');
    if (listEl) listEl.innerHTML = `<p class="muted">Erreur : ${friendlyErrorMessage(err)}</p>`;
    const tileEl = document.getElementById('personas-tile-list');
    if (tileEl) tileEl.innerHTML = `<p class="muted" style="font-size:12px;">Erreur de chargement.</p>`;
  }
}

function renderPersonaList() {
  const listEl = document.getElementById('persona-list');
  if (!listEl) return;

  if (!allPersonas.length) {
    listEl.innerHTML = '<p class="muted" style="font-size:12px;">Aucun persona enregistré pour l\'instant.</p>';
    return;
  }

  listEl.innerHTML = allPersonas
    .map(
      (p) => `
      <div class="card" style="background:rgba(255,255,255,0.03);padding:10px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:6px;">
          <strong>${escapeHtml(p.name)}</strong>
          <button class="icon-btn btn-delete-persona" title="Supprimer" data-id="${p.id}">🗑</button>
        </div>
        ${p.tone_of_voice ? `<p class="muted" style="font-size:12px;margin:4px 0;">${escapeHtml(p.tone_of_voice)}</p>` : ''}
      </div>
    `
    )
    .join('');

  listEl.querySelectorAll('.btn-delete-persona').forEach((btn) => {
    btn.addEventListener('click', () => deletePersona(btn.dataset.id));
  });
}

function renderPersonaDropdownOptions() {
  const select = document.getElementById('persona-select');
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML =
    '<option value="">Standard (par défaut)</option>' +
    allPersonas.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  select.value = currentValue || '';
}

async function savePersona() {
  const messageEl = document.getElementById('persona-message');
  clearMessage(messageEl);

  const name = document.getElementById('persona-name').value.trim();
  const tone_of_voice = document.getElementById('persona-tone').value.trim();
  const vocabulary = document.getElementById('persona-vocabulary').value.trim();
  const forbidden_words = document.getElementById('persona-forbidden').value.trim();
  const custom_instructions = document.getElementById('persona-instructions').value.trim();

  if (!name) {
    showMessage(messageEl, 'Le nom du persona est requis.', 'error');
    return;
  }

  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/personas`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, tone_of_voice, vocabulary, forbidden_words, custom_instructions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'enregistrement.');

    ['persona-name', 'persona-tone', 'persona-vocabulary', 'persona-forbidden', 'persona-instructions'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    showMessage(messageEl, 'Persona enregistré !', 'success');
    await loadPersonas();
  } catch (err) {
    showMessage(messageEl, friendlyErrorMessage(err), 'error');
  }
}

async function deletePersona(id) {
  const confirmed = window.confirm('Supprimer ce persona ?');
  if (!confirmed) return;

  const headers = await authHeadersOrNull();
  if (!headers) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/personas/${id}`, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 204) throw new Error('Erreur lors de la suppression.');
    await loadPersonas();
  } catch (err) {
    alert(friendlyErrorMessage(err));
  }
}

async function extractPersonaFromScript() {
  const messageEl = document.getElementById('persona-message');
  clearMessage(messageEl);

  const script = document.getElementById('persona-extract-script').value;
  if (!script.trim()) {
    showMessage(messageEl, 'Colle un script à analyser.', 'error');
    return;
  }

  const headers = await authHeadersOrNull();
  if (!headers) return;

  const btn = document.getElementById('btn-extract-persona');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Analyse en cours...';

  try {
    const res = await fetch(`${API_BASE_URL}/api/extract-persona`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ script }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'analyse.');

    const persona = data.persona || {};
    document.getElementById('persona-name').value = persona.name || '';
    document.getElementById('persona-tone').value = persona.tone_of_voice || '';
    document.getElementById('persona-vocabulary').value = persona.vocabulary || '';
    document.getElementById('persona-forbidden').value = persona.forbidden_words || '';
    document.getElementById('persona-instructions').value = persona.custom_instructions || '';

    showMessage(messageEl, 'Persona extrait ! Vérifie les champs ci-dessous puis clique sur "Enregistrer ce persona".', 'success');
  } catch (err) {
    showMessage(messageEl, friendlyErrorMessage(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// --------------------- Réponses intelligentes aux commentaires ---------------------
// IMPORTANT : l'API publique de TikTok (celle utilisée pour connecter le
// compte dans cette app) ne permet ni de récupérer automatiquement les
// commentaires d'une vidéo, ni d'y répondre automatiquement — ces accès
// sont réservés à des partenariats business spécifiques, pas aux apps
// tierces classiques comme celle-ci. Le fonctionnement est donc : tu colles
// toi-même les commentaires (copiés depuis l'app TikTok), l'IA propose une
// réponse pour chacun, et tu la copies pour la coller toi-même sur TikTok
// (un lien "Ouvrir la vidéo" t'y emmène directement).

function ensureRepliesUI() {
  if (document.getElementById('replies-section')) return; // déjà injecté

  const section = document.createElement('div');
  section.id = 'replies-section';
  section.className = 'card';
  section.style.marginTop = '20px';
  section.innerHTML = `
    <h3 style="margin-top:0;">💬 Réponses intelligentes aux commentaires</h3>
    <p class="muted" style="margin-top:0;">
      Colle les commentaires reçus sous une de tes vidéos TikTok (un par ligne), choisis une voix, et l'IA rédige
      une proposition de réponse pour chacun — à toi de la valider ou de la modifier avant de la publier toi-même sur TikTok.
    </p>
    <input id="replies-video-url" placeholder="Lien de la vidéo TikTok (optionnel, pour l'ouvrir directement)" style="width:100%;margin-bottom:8px;" />
    <label style="display:block;font-size:13px;margin-bottom:4px;">Voix / Personnage à utiliser</label>
    <select id="replies-persona-select" style="width:100%;margin-bottom:8px;">
      <option value="">Standard (par défaut)</option>
    </select>
    <textarea id="replies-comments" rows="6" placeholder="Colle les commentaires ici, un par ligne..." style="width:100%;"></textarea>
    <button id="btn-generate-replies" style="margin-top:8px;">Générer les réponses</button>
    <div id="replies-message"></div>
    <div id="replies-results" style="margin-top:12px;display:grid;gap:8px;"></div>
  `;

  el.extraTools.appendChild(section);
  document.getElementById('btn-generate-replies').addEventListener('click', generateReplies);
}

function renderRepliesPersonaOptions() {
  const select = document.getElementById('replies-persona-select');
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML =
    '<option value="">Standard (par défaut)</option>' +
    allPersonas.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  select.value = currentValue || '';
}

async function generateReplies() {
  const messageEl = document.getElementById('replies-message');
  const resultsEl = document.getElementById('replies-results');
  clearMessage(messageEl);
  resultsEl.innerHTML = '';

  const rawComments = document.getElementById('replies-comments').value;
  const comments = rawComments
    .split('\n')
    .map((c) => c.trim())
    .filter(Boolean);
  const persona_id = document.getElementById('replies-persona-select').value || undefined;
  const videoUrl = document.getElementById('replies-video-url').value.trim();

  if (!comments.length) {
    showMessage(messageEl, 'Colle au moins un commentaire.', 'error');
    return;
  }

  const headers = await authHeadersOrNull();
  if (!headers) return;

  const btn = document.getElementById('btn-generate-replies');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Génération en cours...';

  try {
    const res = await fetch(`${API_BASE_URL}/api/generate-replies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ comments, persona_id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération.');

    renderReplyResults(data.replies || [], videoUrl);
  } catch (err) {
    showMessage(messageEl, friendlyErrorMessage(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function renderReplyResults(replies, videoUrl) {
  const resultsEl = document.getElementById('replies-results');
  if (!replies.length) {
    resultsEl.innerHTML = '<p class="muted">Aucune réponse générée.</p>';
    return;
  }

  resultsEl.innerHTML = replies
    .map(
      (r, i) => `
      <div class="card" style="background:rgba(255,255,255,0.03);padding:10px;font-size:13px;">
        <p class="muted" style="margin:0 0 6px;">💬 ${escapeHtml(r.comment)}</p>
        <textarea class="reply-text-input" data-index="${i}" rows="2" style="width:100%;">${escapeHtml(r.reply)}</textarea>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
          <button class="secondary btn-copy-reply" data-index="${i}" style="font-size:12px;">📋 Copier la réponse</button>
          ${videoUrl ? `<a href="${videoUrl}" target="_blank" rel="noopener" class="secondary" style="font-size:12px;text-decoration:none;display:inline-block;padding:6px 10px;border-radius:6px;">🔗 Ouvrir la vidéo sur TikTok</a>` : ''}
        </div>
      </div>
    `
    )
    .join('');

  resultsEl.querySelectorAll('.btn-copy-reply').forEach((copyBtn) => {
    copyBtn.addEventListener('click', () => {
      const textarea = resultsEl.querySelector(`.reply-text-input[data-index="${copyBtn.dataset.index}"]`);
      navigator.clipboard.writeText(textarea.value);
      const original = copyBtn.textContent;
      copyBtn.textContent = '✅ Copié !';
      setTimeout(() => { copyBtn.textContent = original; }, 1500);
    });
  });
}

// --------------------------------------------------------------

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) {
    el.viewPublic.classList.add('hidden');
    el.viewDashboard.classList.remove('hidden');
    el.nav.innerHTML = `
      <span class="muted">${session.user.email}</span>
      <button class="secondary" id="btn-open-profile-nav">⚙️ Profil</button>
      <button class="secondary" id="btn-logout">Se déconnecter</button>
    `;
    document.getElementById('btn-open-profile-nav').addEventListener('click', () => {
      el.profileModal.classList.remove('hidden');
    });
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
