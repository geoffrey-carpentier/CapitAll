// Règles de gestion du portefeuille, écrites en fonctions pures : elles reçoivent un
// tableau de transactions et rendent un résultat, sans accès à la base ni à HTTP.
// C'est ce qui les rend testables seules, et c'est la structure que reprendra le lot
// des calculs financiers (PRU, plus-values).
//
// Choix de calcul : les quantités sont converties en entiers de la plus petite unité
// représentable (10^-8, soit le maximum de décimales accepté à la validation) et
// accumulées en BigInt. Additionner des nombres à virgule flottante ferait apparaître
// des écarts du type 0.1 + 0.2 = 0.30000000000000004, inacceptables sur des quantités
// financières. Le résultat est rendu sous forme de chaîne, donc exact de bout en bout.

const { ErreurValidation } = require('../erreurs');

const DECIMALES = 8;
const FACTEUR = 10n ** BigInt(DECIMALES);

function versUnites(valeur) {
  const [entier, decimales = ''] = String(valeur).trim().split('.');
  const decimalesCompletees = decimales.padEnd(DECIMALES, '0').slice(0, DECIMALES);
  return BigInt(entier) * FACTEUR + BigInt(decimalesCompletees);
}

function versChaine(unites) {
  const negatif = unites < 0n;
  const absolu = negatif ? -unites : unites;
  const partieEntiere = absolu / FACTEUR;
  const partieDecimale = (absolu % FACTEUR).toString().padStart(DECIMALES, '0').replace(/0+$/, '');

  return `${negatif ? '-' : ''}${partieEntiere}${partieDecimale ? `.${partieDecimale}` : ''}`;
}

// Quantité restant détenue sur un actif : somme des achats moins somme des ventes.
// Rendue en chaîne pour rester exacte.
function quantiteDetenue(transactions) {
  const total = transactions.reduce((cumul, transaction) => {
    const unites = versUnites(transaction.quantite);
    return transaction.sens === 'achat' ? cumul + unites : cumul - unites;
  }, 0n);

  return versChaine(total);
}

// Règle « on ne vend pas plus que ce que l'on détient ». Elle porte sur l'agrégat de
// plusieurs lignes de transaction : aucune contrainte SQL ne peut l'exprimer, elle
// est donc vérifiée ici, côté serveur (voir modele-de-donnees.md).
function verifierVenteAutorisee(transactions, quantiteVendue) {
  const detenu = versUnites(quantiteDetenue(transactions));
  const vendu = versUnites(quantiteVendue);

  if (vendu > detenu) {
    throw new ErreurValidation(
      `Quantité insuffisante : vous détenez ${versChaine(detenu)} sur cet actif.`
    );
  }
}

module.exports = { quantiteDetenue, verifierVenteAutorisee };
