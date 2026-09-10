import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname n'existe pas nativement avec les modules ES (import/export) —
// on le recrée à partir de l'URL du fichier courant.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Sert tous les fichiers du dossier public/ (index.html, style.css, app.js,
// config.js...) tels quels, comme le ferait n'importe quel hébergeur statique.
app.use(express.static(path.join(__dirname, 'public')));

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
