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

// Règle de gestion non respectée, au-delà de la simple forme des données.
//
// Le second paramètre, facultatif, rattache l'erreur à un ou plusieurs champs du
// formulaire, au format exact que produit déjà le middleware de validation :
// [{ champ, message }]. Il sert aux règles qu'un schéma ne peut pas trancher seul
// parce qu'elles demandent la base — un ancien mot de passe à comparer, par exemple.
// Sans lui, l'interface ne saurait que signaler l'erreur en tête de formulaire.
class ErreurValidation extends ErreurMetier {
  constructor(message, champs = null) {
    super(message, 400);
    this.champs = champs;
  }
}

// Ressource inexistante, ou appartenant à quelqu'un d'autre : les deux cas renvoient
// volontairement le même statut, voir le commentaire des contrôleurs du portefeuille.
class ErreurIntrouvable extends ErreurMetier {
  constructor(message) {
    super(message, 404);
  }
}

// Un fournisseur de cours externe est indisponible ou a renvoyé une réponse
// inexploitable. 503 : le défaut est passager et ne vient pas de la requête du client.
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
