// Règles de gestion du portefeuille, écrites en fonctions pures : elles reçoivent un
// tableau de transactions et rendent un résultat, sans accès à la base ni à HTTP.
// C'est ce qui les rend testables seules, et ce qui permet de dérouler le calcul
// devant un jury sans démarrer l'application.
//
// L'arithmétique exacte est portée par src/utils/decimal.js, partagé avec le moteur
// de calcul du PRU et des plus-values.

const { ErreurValidation } = require('../erreurs');
const { ECHELLE_QUANTITE, versUnites, versChaine } = require('../utils/decimal');
const { trierChronologiquement } = require('./calculPortefeuille');

// Quantité restant détenue sur un actif : les achats font entrer, tout le reste fait
// sortir. Une vente et une sortie non marchande diffèrent par ce qu'elles rapportent,
// jamais par ce qu'elles retirent de la position (D89).
// Rendue en chaîne pour rester exacte de bout en bout.
function quantiteDetenue(transactions) {
  const total = transactions.reduce((cumul, transaction) => {
    const unites = versUnites(transaction.quantite, ECHELLE_QUANTITE);
    return transaction.sens === 'achat' ? cumul + unites : cumul - unites;
  }, 0n);

  return versChaine(total, ECHELLE_QUANTITE);
}

// Règle « on ne vend pas plus que ce que l'on détient ». Elle porte sur l'agrégat de
// plusieurs lignes de transaction : aucune contrainte SQL ne peut l'exprimer, elle
// est donc vérifiée ici, côté serveur (voir modele-de-donnees.md).
function verifierVenteAutorisee(transactions, quantiteVendue) {
  const detenu = versUnites(quantiteDetenue(transactions), ECHELLE_QUANTITE);
  const vendu = versUnites(quantiteVendue, ECHELLE_QUANTITE);

  if (vendu > detenu) {
    throw new ErreurValidation(
      `Quantité insuffisante : vous détenez ${versChaine(detenu, ECHELLE_QUANTITE)} sur cet actif.`
    );
  }
}

// Une sortie rétroactive ne doit pas seulement être possible au regard du solde final :
// elle doit laisser valide chaque étape qui la suit. Le contrôle rejoue donc tous les
// mouvements dans l'ordre du domaine et refuse le premier préfixe qui passerait sous
// zéro. Le message indique la quantité réellement disponible juste avant le mouvement
// en défaut, qu'il s'agisse de celui qu'on ajoute ou d'un mouvement ultérieur qu'il
// rendrait invalide.
//
// Ventes et sorties non marchandes sont traitées à égalité : la règle est qu'on ne fait
// pas sortir plus qu'on ne détient, et elle ne dépend pas de ce que le mouvement
// rapporte. Nommer ce contrôle d'après les seules ventes laisserait croire qu'un
// transfert y échappe.
function verifierHistoriqueSortiesAutorisees(transactions) {
  let detenu = 0n;

  for (const transaction of trierChronologiquement(transactions)) {
    const quantite = versUnites(transaction.quantite, ECHELLE_QUANTITE);

    if (transaction.sens === 'achat') {
      detenu += quantite;
      continue;
    }

    if (quantite > detenu) {
      // Le mouvement fautif voyage avec l'erreur. L'appelant en a besoin pour savoir
      // s'il s'agit de celui qu'il vient de saisir — auquel cas le message de la règle
      // convient — ou d'un mouvement postérieur que sa saisie rendrait impossible,
      // situation qui appelle une autre phrase. Le message, lui, ne change pas : les
      // appelants qui ne s'en soucient pas voient exactement ce qu'ils voyaient.
      const erreur = new ErreurValidation(
        `Quantité insuffisante : vous détenez ${versChaine(detenu, ECHELLE_QUANTITE)} sur cet actif.`
      );
      erreur.mouvement = transaction;
      throw erreur;
    }

    detenu -= quantite;
  }
}

module.exports = {
  quantiteDetenue,
  verifierVenteAutorisee,
  verifierHistoriqueSortiesAutorisees,
};
