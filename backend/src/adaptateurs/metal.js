// Adaptateur gold-api : cours des métaux précieux (XAU, XAG).
//
// Particularité de ce fournisseur : le prix est libellé en DOLLARS PAR ONCE. La
// conversion en euros est donc obligatoire. Le taux de change n'est pas redemandé
// ici : la fonction obtenirTauxUsdEur est injectée dans la factory, et passe par le
// service de cours, donc par le cache. Dupliquer l'appel Frankfurter dans cet
// adaptateur multiplierait les appels sortants pour la même donnée.

const { ErreurFournisseur } = require('../erreurs');
const { chaineDecimalePositive } = require('./valeur');
const { ECHELLE_PRIX, ECHELLE_TAUX, versUnites, versChaine, multiplier } = require('../utils/decimal');

const BASE_URL = 'https://api.gold-api.com';
const SOURCE = 'gold-api';

// L'unité de cotation. gold-api publie un prix par ONCE TROY, et c'est l'unité dans
// laquelle les quantités sont saisies et affichées (D88) : le produit quantité × cours a
// donc un sens sans conversion. L'interface affichait auparavant des grammes sur des
// quantités qui étaient des onces, ce qui faisait mentir le libellé d'un facteur 31.
const UNITE = 'once troy';

function creerAdaptateurMetal({ recupererJson, obtenirTauxUsdEur }) {
  async function getCours(symbole) {
    const symboleNormalise = symbole.toUpperCase();
    const reponse = await recupererJson(
      `${BASE_URL}/price/${encodeURIComponent(symboleNormalise)}`
    );

    const prixUsd = chaineDecimalePositive(reponse?.price);

    if (prixUsd === null) {
      throw new ErreurFournisseur(`gold-api n'a pas renvoyé de prix pour ${symboleNormalise}.`);
    }

    const tauxUsdEur = chaineDecimalePositive(await obtenirTauxUsdEur());

    if (tauxUsdEur === null) {
      throw new ErreurFournisseur(
        'Taux de change USD vers EUR indisponible, conversion du métal impossible.'
      );
    }

    // La conversion se fait en entiers, comme le reste du projet (D4).
    //
    // Elle était auparavant faite en virgule flottante puis arrondie au centime, au
    // motif qu'un cours est une donnée approximative. L'argument ne tient plus : le
    // cours est désormais conservé à l'échelle des prix, et l'arrondir au centime à
    // l'entrée effacerait précisément ce que le contrat numérique vient d'ouvrir.
    return {
      symbole: symboleNormalise,
      cours_eur: versChaine(
        multiplier(
          versUnites(prixUsd, ECHELLE_PRIX),
          ECHELLE_PRIX,
          versUnites(tauxUsdEur, ECHELLE_TAUX),
          ECHELLE_TAUX,
          ECHELLE_PRIX
        ),
        ECHELLE_PRIX
      ),
      unite: UNITE,
      horodatage: reponse.updatedAt
        ? new Date(reponse.updatedAt).toISOString()
        : new Date().toISOString(),
      source: SOURCE,
    };
  }

  return { getCours, source: SOURCE };
}

module.exports = { creerAdaptateurMetal, BASE_URL, SOURCE, UNITE };
