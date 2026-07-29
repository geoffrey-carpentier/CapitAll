// Règles de gestion du portefeuille, écrites en fonctions pures : elles reçoivent un
// tableau de transactions et rendent un résultat, sans accès à la base ni à HTTP.
// C'est ce qui les rend testables seules, et ce qui permet de dérouler le calcul
// devant un jury sans démarrer l'application.
//
// L'arithmétique exacte est portée par src/utils/decimal.js, partagé avec le moteur
// de calcul du PRU et des plus-values.

const { ErreurValidation } = require('../erreurs');
const { ECHELLE_QUANTITE, versUnites, versChaine } = require('../utils/decimal');

// Quantité restant détenue sur un actif : somme des achats moins somme des ventes.
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

module.exports = { quantiteDetenue, verifierVenteAutorisee };
