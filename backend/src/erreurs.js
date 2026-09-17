// Erreurs métier : les services les lèvent sans connaître HTTP, le gestionnaire
// centralisé les traduit en réponse.

class ErreurMetier extends Error {
  constructor(message, statut) {
    super(message);
    this.name = this.constructor.name;
    this.statut = statut;
  }
}

// Règle de gestion non respectée. `champs`, facultatif, rattache l'erreur à des champs
// du formulaire au format du middleware de validation : [{ champ, message }].
class ErreurValidation extends ErreurMetier {
  constructor(message, champs = null) {
    super(message, 400);
    this.champs = champs;
  }
}

// Ressource inexistante ou d'un autre compte : même statut, pour ne rien révéler.
class ErreurIntrouvable extends ErreurMetier {
  constructor(message) {
    super(message, 404);
  }
}

// Fournisseur de cours indisponible ou réponse inexploitable : 503, défaut passager.
class ErreurFournisseur extends ErreurMetier {
  constructor(message) {
    super(message, 503);
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
  ErreurValidation,
  ErreurIntrouvable,
  ErreurConflit,
  ErreurFournisseur,
  ErreurAuthentification,
  ErreurAutorisation,
};
