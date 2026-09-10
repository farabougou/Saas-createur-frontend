# Frontend — SaaS créateurs de contenu

Site web statique (HTML/CSS/JS, sans framework ni étape de build) qui
consomme l'API backend (`saas-createur-backend`) et Supabase Auth
directement depuis le navigateur.

## Avant de déployer

Ouvre `public/config.js` et vérifie les 3 valeurs :

- `SUPABASE_URL` — déjà rempli
- `SUPABASE_ANON_KEY` — **à remplacer** par ta vraie clé anon (Supabase >
  Clés API > onglet "Anonyme hérité, service_role clés API"). C'est une
  clé publique, sans danger à exposer ici : la vraie sécurité vient des
  règles RLS posées dans la base.
- `API_BASE_URL` — l'adresse de ton backend Railway (déjà remplie)

## En local

```bash
npm install
npm start
# ouvre http://localhost:3000
```

## Déploiement sur Railway

Exactement le même principe que pour le backend :

1. Pousse ce dossier dans un **nouveau** repo GitHub (ex:
   `Saas-createur-frontend`).
2. Railway → New Project → Deploy from GitHub repo → sélectionne le repo.
3. Railway détecte Node.js via `package.json`, aucune variable
   d'environnement n'est nécessaire ici (tout est dans `config.js`).
4. Une fois déployé, Settings → Networking → Generate Domain.

## Domaine personnalisé (Dynadot)

Une fois le site en ligne sur Railway, Settings → Networking → Custom
Domain → renseigne ton domaine (ex. `www.tondomaine.com` ou directement
`tondomaine.com`). Railway donne un enregistrement DNS à créer. Dans
Dynadot : DNS Manager de ton domaine → ajoute cet enregistrement tel
quel. La propagation prend de quelques minutes à quelques heures.

## Ce que fait chaque fichier

- `server.js` — petit serveur Express qui sert les fichiers de `public/`
- `public/index.html` — structure de la page (plans, connexion, espace
  utilisateur)
- `public/style.css` — mise en forme
- `public/config.js` — les 3 valeurs de configuration à remplir
- `public/app.js` — toute la logique : charger les plans, inscription,
  connexion, appels à l'API backend avec le token Supabase
