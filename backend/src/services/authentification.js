// Logique métier de l'authentification. Ce service ne connaît ni Express ni les codes
// HTTP : il renvoie des données ou lève une erreur métier, ce qui le rend testable seul.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const modeleUtilisateur = require('../models/utilisateur');
const { ErreurConflit, ErreurAuthentification, ErreurAutorisation } = require('../erreurs');

const COUT_HACHAGE = 10;

// Code renvoyé par PostgreSQL sur violation d'une contrainte d'unicité.
const CODE_VIOLATION_UNICITE = '23505';

const LONGUEUR_MAXIMALE_PSEUDO = 100;

// Hachage neutre, servant de comparaison de repli quand l'email est inconnu.
// Sans lui, une réponse immédiate sur email inexistant et une réponse retardée par
// bcrypt sur email existant permettraient de déterminer quels comptes existent.
// Calculé une seule fois au chargement du module : bcrypt est volontairement lent.
const HACHAGE_FACTICE = bcrypt.hashSync('comparaison-a-temps-constant', COUT_HACHAGE);

const MESSAGE_ECHEC = 'Email ou mot de passe incorrect.';

// Le pseudo est facultatif à l'inscription alors que la colonne est obligatoire :
// à défaut, on reprend la partie locale de l'email.
function pseudoParDefaut(email) {
  return email.split('@')[0].slice(0, LONGUEUR_MAXIMALE_PSEUDO);
}

// Le modèle est reçu en paramètre, comme dans les services de portefeuille et de cours :
// le service s'exécute alors sans base dans les tests, avec le code de production.
function creerServiceAuthentification({ utilisateurs = modeleUtilisateur } = {}) {
  async function inscrire({ email, motDePasse, pseudo }) {
    const motDePasseHache = await bcrypt.hash(motDePasse, COUT_HACHAGE);

    try {
      return await utilisateurs.creerUtilisateur({
        email,
        motDePasseHache,
        pseudo: pseudo || pseudoParDefaut(email),
      });
    } catch (erreur) {
      // Deux inscriptions simultanées sur le même email passeraient toutes deux un
      // contrôle préalable en lecture : c'est la contrainte d'unicité de la base qui
      // fait foi, et sa violation est traduite ici en erreur métier.
      if (erreur.code === CODE_VIOLATION_UNICITE) {
        throw new ErreurConflit('Cet email est déjà utilisé.');
      }
      throw erreur;
    }
  }

  async function connecter({ email, motDePasse }) {
    const utilisateur = await utilisateurs.trouverParEmail(email);
    const hachageAComparer = utilisateur ? utilisateur.mot_de_passe_hache : HACHAGE_FACTICE;

    const motDePasseValide = await bcrypt.compare(motDePasse, hachageAComparer);

    // Un seul message pour les deux causes d'échec : rien n'indique si c'est l'email
    // ou le mot de passe qui est en cause.
    if (!utilisateur || !motDePasseValide) {
      throw new ErreurAuthentification(MESSAGE_ECHEC);
    }

    // Le contrôle du compte désactivé vient volontairement APRÈS la comparaison de mot
    // de passe. Placé avant, il court-circuiterait bcrypt et rendrait la réponse sur un
    // compte désactivé plus rapide que sur un compte actif : l'écart de temps
    // permettrait de découvrir quels comptes existent, soit exactement la fuite que le
    // hachage factice ci-dessus neutralise.
    //
    // À ce stade les identifiants sont reconnus valides : la personne a prouvé qu'elle
    // possède le compte, et lui dire qu'il est désactivé ne lui apprend rien qu'elle
    // ignore. Un message distinct est donc préférable ici, un échec générique la
    // laisserait chercher une faute de saisie inexistante. Le statut 403 traduit la
    // situation : l'identité est établie, c'est l'accès qui est refusé.
    if (!utilisateur.actif) {
      throw new ErreurAutorisation('Ce compte a été désactivé.');
    }

    const token = jwt.sign({ sub: utilisateur.id, role: utilisateur.role }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiration,
    });

    return {
      token,
      utilisateur: {
        id: utilisateur.id,
        email: utilisateur.email,
        pseudo: utilisateur.pseudo,
        role: utilisateur.role,
      },
    };
  }

  return { inscrire, connecter };
}

// Instance par défaut, utilisée par les contrôleurs : leur code reste inchangé.
const service = creerServiceAuthentification();

module.exports = {
  creerServiceAuthentification,
  // Le coût de hachage est exporté pour que le changement de mot de passe applique
  // exactement le même que l'inscription : deux valeurs distinctes produiraient des
  // hachages de robustesse inégale selon la façon dont le compte a été créé.
  COUT_HACHAGE,
  inscrire: service.inscrire,
  connecter: service.connecter,
};
