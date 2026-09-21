import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname n'existe pas nativement avec les modules ES (import/export) —
// on le recrée à partir de l'URL du fichier courant.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Anciennes adresses des pages légales : on redirige vers les versions à jour
// (une seule version de chaque texte à maintenir).
app.get('/confidentialite.html', (req, res) => res.redirect(301, '/privacy.html'));
app.get('/conditions-utilisation.html', (req, res) => res.redirect(301, '/terms.html'));

// Dossier /.well-known (ex. assetlinks.json, qui relie l'application Android
// à ce site). Express ignore par défaut les dossiers commençant par un point :
// on l'autorise explicitement ici. Une adresse inconnue renvoie une vraie 404
// (et non la page d'accueil), comme l'exigent Google et Apple.
app.use(
  '/.well-known',
  express.static(path.join(__dirname, 'public', '.well-known'), { dotfiles: 'allow' })
);
app.use('/.well-known', (req, res) => res.status(404).end());

// Sert tous les fichiers du dossier public/ (index.html, style.css, app.js,
// config.js...) tels quels, comme le ferait n'importe quel hébergeur statique.
app.use(express.static(path.join(__dirname, 'public')));

// Vitrine publique d'une boutique : https://.../b/nom-de-la-boutique
// (la page lit le nom dans l'adresse et charge la boutique depuis le backend).
app.get('/b/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'boutique.html'));
});

// Si quelqu'un visite une adresse qui n'existe pas (ex: rechargement de page
// sur une route gérée côté JavaScript), on renvoie quand même index.html
// plutôt qu'une erreur 404 — c'est le comportement standard pour un site
// dont la navigation est gérée en JavaScript.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Site démarré sur le port ${port}`);
});
