// Adaptateur gold-api : cours des métaux précieux.
//
// Le prix est en dollars par once : obtenirTauxUsdEur, injecté, fournit le taux en
// passant par le service de cours, donc par le cache.

const { ErreurFournisseur } = require('../erreurs');
const { chaineDecimalePositive } = require('./valeur');
const { ECHELLE_PRIX, ECHELLE_TAUX, versUnites, versChaine, multiplier } = require('../utils/decimal');

const BASE_URL = 'https://api.gold-api.com';
const SOURCE = 'gold-api';

// Unité de cotation, qui est aussi celle des quantités saisies : quantité × cours se
// calcule sans conversion.
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

    // Conversion exacte en entiers, conservée à l'échelle des prix.
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
