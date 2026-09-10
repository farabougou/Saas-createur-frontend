// Configuration publique du site.
//
// Ces valeurs sont volontairement visibles dans le navigateur (ce n'est pas
// une faille de sécurité) : SUPABASE_ANON_KEY est une clé "publique", conçue
// pour être exposée côté client — la vraie protection des données vient des
// règles RLS posées dans Supabase, pas du secret de cette clé.
//
// Remplis les 3 valeurs ci-dessous avant de déployer.

window.APP_CONFIG = {
  // Supabase > Settings > API Keys > onglet "Anonyme hérité, service_role clés API"
  SUPABASE_URL: 'https://khgdplygiaqgvlducnvl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoZ2RwbHlnaWFxZ3ZsZHVjbnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMzI4MTEsImV4cCI6MjEwNDYwODgxMX0.gUPrU4T4vCAHACLUov64R8UgyZOIwrMsEsoDbd-OIOc',

  // L'URL de ton backend Railway (celle qui répond déjà sur /health)
  API_BASE_URL: 'https://saas-createur-backend-production.up.railway.app',
};
