// Gestionnaire d'erreurs centralisé, branché en dernier dans app.js. Il est le seul
// endroit du back-end qui décide du code HTTP renvoyé sur erreur, et le seul à
// journaliser. Le client ne reçoit qu'un message : ni pile d'appels, ni détail
// technique, ni message d'erreur SQL, qui renseigneraient un attaquant sur la
// structure interne de l'application.

const { ErreurMetier } = require('../erreurs');

// La signature à quatre paramètres est ce qui identifie un gestionnaire d'erreurs
// auprès d'Express : next doit rester présent même s'il n'est pas utilisé.
// eslint-disable-next-line no-unused-vars
function gestionErreurs(erreur, req, res, next) {
  if (erreur instanceof ErreurMetier) {
    // Le détail par champ n'est ajouté que si l'erreur en porte un : les erreurs
    // existantes n'en ont pas et leur réponse reste inchangée.
    const corps = { erreur: erreur.message };
    if (erreur.champs) {
      corps.champs = erreur.champs;
    }
    return res.status(erreur.statut).json(corps);
  }

  // Le journal ne reçoit ni la chaîne de requête ni l'objet d'erreur entier.
  //
  // La chaîne de requête porte des valeurs saisies par l'appelant : le chemin suffit à
  // situer l'incident. Et une erreur PostgreSQL transporte un champ `detail` qui recopie
  // la valeur en cause — « Key (email)=(...) already exists » — ce qui déposerait une
  // adresse d'utilisateur dans les journaux du serveur à chaque conflit d'unicité. Le
  // message et la pile d'appels situent le défaut sans rien recopier des données.
  console.error(
    `Erreur non gérée sur ${req.method} ${req.path} : ${erreur.name} — ${erreur.message}`
  );
  if (erreur.stack) {
    console.error(erreur.stack);
  }
  return res.status(500).json({ erreur: 'Une erreur interne est survenue.' });
}

module.exports = gestionErreurs;
