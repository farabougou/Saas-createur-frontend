// Suppression du compte par l'utilisateur (exigée par Apple, Google et le RGPD).
// Ouvre une fenêtre de confirmation, appelle DELETE /api/me sur le backend,
// puis renvoie l'utilisateur sur la page d'accueil.
(function () {
  'use strict';

  var CONFIRM_WORD = 'SUPPRIMER';

  // ---------- Message affiché après une suppression réussie ----------
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get('compte') === 'supprime') {
      var notice = document.createElement('div');
      notice.className = 'account-deleted-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = 'Votre compte a bien été supprimé. Merci d’avoir utilisé SaaS Créateurs.';
      document.body.appendChild(notice);
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(function () { notice.remove(); }, 8000);
    }
  } catch (e) { /* sans importance */ }

  var profileModal = document.getElementById('profile-modal');
  var modal = document.getElementById('delete-account-modal');
  var openBtn = document.getElementById('btn-open-delete-account');
  if (!modal || !openBtn) return;

  var closeBtn = document.getElementById('btn-close-delete-account');
  var cancelBtn = document.getElementById('btn-cancel-delete-account');
  var input = document.getElementById('delete-account-confirm');
  var confirmBtn = document.getElementById('btn-confirm-delete-account');
  var message = document.getElementById('delete-account-message');
  var busy = false;

  function isConfirmed() {
    return input.value.trim().toUpperCase() === CONFIRM_WORD;
  }

  function refreshButton() {
    confirmBtn.disabled = busy || !isConfirmed();
  }

  function showError(text) {
    message.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'message error';
    box.textContent = text;
    message.appendChild(box);
  }

  function openModal() {
    input.value = '';
    message.innerHTML = '';
    busy = false;
    refreshButton();
    if (profileModal) profileModal.classList.add('hidden');
    modal.classList.remove('hidden');
    setTimeout(function () { input.focus({ preventScroll: true }); }, 100);
  }

  function closeModal() {
    if (busy) return;
    modal.classList.add('hidden');
  }

  async function deleteAccount() {
    if (busy || !isConfirmed()) return;
    busy = true;
    refreshButton();
    confirmBtn.textContent = 'Suppression en cours…';
    message.innerHTML = '';

    try {
      var sessionResult = await supabaseClient.auth.getSession();
      var session = sessionResult.data && sessionResult.data.session;
      if (!session) throw new Error('Votre session a expiré. Reconnectez-vous puis réessayez.');

      var res = await fetch(API_BASE_URL + '/api/me', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm: CONFIRM_WORD }),
      });

      if (!res.ok) {
        var detail = '';
        try { detail = (await res.json()).error || ''; } catch (e) { /* corps vide */ }
        throw new Error(detail || 'La suppression a échoué. Réessayez dans un instant.');
      }

      // Le compte n'existe plus : on efface la session locale sans appeler le serveur.
      try { await supabaseClient.auth.signOut({ scope: 'local' }); } catch (e) { /* déjà invalide */ }
      window.location.replace('/?compte=supprime');
    } catch (err) {
      busy = false;
      confirmBtn.textContent = 'Supprimer définitivement';
      refreshButton();
      showError(err.message || 'La suppression a échoué. Réessayez dans un instant.');
    }
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });
  input.addEventListener('input', refreshButton);
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      deleteAccount();
    }
  });
  confirmBtn.addEventListener('click', deleteAccount);
})();
