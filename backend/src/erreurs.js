// Erreurs métier. Les services lèvent ces erreurs plutôt que de manipuler des codes
// HTTP : la couche métier reste testable sans Express, et le gestionnaire centralisé
// se charge seul de la traduction en réponse HTTP.

class ErreurMetier extends Error {
  constructor(message, statut) {
    super(message);
    this.name = this.constructor.name;
    this.statut = statut;
  }
}

// Ressource déjà existante, typiquement un email déjà inscrit.
class ErreurConflit extends ErreurMetier {
  constructor(message) {
    super(message, 409);
  }
}

// Échec d'authentification. Le message reste volontairement générique.
class ErreurAuthentification extends ErreurMetier {
  constructor(message) {
    super(message, 401);
  }
}

// Utilisateur authentifié mais dont le rôle ne permet pas l'action.
class ErreurAutorisation extends ErreurMetier {
  constructor(message) {
    super(message, 403);
  }
}

module.exports = {
  ErreurMetier,
  ErreurConflit,
  ErreurAuthentification,
  ErreurAutorisation,
};
