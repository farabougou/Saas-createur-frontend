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
  // Si ça réussit, onAuthStateChange (plus bas) bascule automatiquement
  // vers le tableau de bord — pas besoin de le faire ici.
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

  // Profil + abonnement.
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

  // Historique des requêtes IA.
  await loadRequests(authHeaders);
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

    el.requestsList.innerHTML = requests
      .map(
        (r) => `
        <div class="request-item">
          <span class="badge">${r.status}</span>
          <strong>${contentTypeLabel(r.request_type)}</strong>
          <p class="muted">${r.prompt}</p>
          ${r.response ? `<p>${r.response.replace(/\n/g, '<br>')}</p>` : ''}
          ${r.status === 'failed' && r.error_message ? `<p class="muted">Erreur : ${r.error_message}</p>` : ''}
        </div>
      `
      )
      .join('');
  } catch (err) {
    el.requestsList.innerHTML = `<p class="muted">Erreur : ${err.message}</p>`;
  }
}

// ---------------------------------------------------------------------
// 7. Envoi d'une nouvelle requête IA (soumise à la limite de 20 / 10 min,
//    appliquée à la fois par l'API et par la base Supabase).
// ---------------------------------------------------------------------
el.formAiRequest.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage(el.aiRequestMessage);

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const request_type = document.getElementById('request-type').value;
  const prompt = document.getElementById('request-prompt').value;
  const submitButton = el.formAiRequest.querySelector('button');

  // L'appel attend la réponse complète de Claude avant de répondre —
  // ça peut prendre quelques secondes, on le montre à l'utilisateur.
  submitButton.disabled = true;
  submitButton.textContent = 'Génération en cours...';

  try {
    const res = await fetch(`${API_BASE_URL}/api/ai-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ request_type, prompt }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Le backend renvoie 429 précisément quand la limite de 20/10min
      // est atteinte (voir enforce_ai_request_rate_limit côté base).
      throw new Error(data.error || 'Erreur lors de l\'envoi.');
    }

    showMessage(el.aiRequestMessage, 'Réponse générée !', 'success');
    el.formAiRequest.reset();
    await loadRequests({ Authorization: `Bearer ${session.access_token}` });
  } catch (err) {
    showMessage(el.aiRequestMessage, err.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Envoyer';
  }
});

// ---------------------------------------------------------------------
// 8. Bascule entre vue publique et tableau de bord selon l'état de
//    connexion. Supabase déclenche cet événement automatiquement au
//    chargement de la page (session existante ou non), puis à chaque
//    connexion/déconnexion.
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
