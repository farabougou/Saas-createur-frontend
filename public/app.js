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
          ${plan.price_cents > 0 ? `<button class="btn-subscribe" data-plan-id="${plan.id}" style="margin-top:8px;width:100%;">S'abonner</button>` : ''}
        </div>
      `
      )
      .join('');

    el.plansGrid.querySelectorAll('.btn-subscribe').forEach((btn) => {
      btn.addEventListener('click', () => subscribeToPlan(btn.dataset.planId));
    });
  } catch (err) {
    el.plansGrid.innerHTML = `<p class="muted">Erreur de chargement des offres (${friendlyErrorMessage(err)})</p>`;
  }
}

async function subscribeToPlan(planId) {
  const headers = await authHeadersOrNull();
  if (!headers) {
    alert("Connecte-toi d'abord pour t'abonner.");
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ plan_id: planId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la création du paiement.');
    window.location.href = data.url;
  } catch (err) {
    alert(friendlyErrorMessage(err));
  }
}
