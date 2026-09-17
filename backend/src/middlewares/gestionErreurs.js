// Gestionnaire d'erreurs centralisé, branché en dernier : seul à choisir le statut HTTP
// et à journaliser. Le client ne reçoit jamais de pile, de détail technique ni d'erreur
// SQL.

const { ErreurMetier } = require('../erreurs');

// Express reconnaît un gestionnaire d'erreurs à ses quatre paramètres : next reste
// présent.
// eslint-disable-next-line no-unused-vars
function gestionErreurs(erreur, req, res, next) {
  if (erreur instanceof ErreurMetier) {
    // Détail par champ seulement si l'erreur en porte un.
    const corps = { erreur: erreur.message };
    if (erreur.champs) {
      corps.champs = erreur.champs;
    }
    return res.status(erreur.statut).json(corps);
  }

  // Ni chaîne de requête ni objet d'erreur entier dans le journal : ils peuvent contenir
  // des données personnelles (le `detail` PostgreSQL recopie par exemple l'email en
  // conflit). Chemin, message et pile suffisent.
  console.error(
    `Erreur non gérée sur ${req.method} ${req.path} : ${erreur.name} — ${erreur.message}`
  );
  if (erreur.stack) {
    console.error(erreur.stack);
  }
  return res.status(500).json({ erreur: 'Une erreur interne est survenue.' });
}

module.exports = gestionErreurs;
