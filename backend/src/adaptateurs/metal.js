// Adaptateur gold-api : cours des métaux précieux (XAU, XAG).
//
// Particularité de ce fournisseur : le prix est libellé en DOLLARS PAR ONCE. La
// conversion en euros est donc obligatoire. Le taux de change n'est pas redemandé
// ici : la fonction obtenirTauxUsdEur est injectée dans la factory, et passe par le
// service de cours, donc par le cache. Dupliquer l'appel Frankfurter dans cet
// adaptateur multiplierait les appels sortants pour la même donnée.

const { ErreurFournisseur } = require('../erreurs');

const BASE_URL = 'https://api.gold-api.com';
const SOURCE = 'gold-api';

const DECIMALES_PRIX = 2;

function creerAdaptateurMetal({ recupererJson, obtenirTauxUsdEur }) {
  async function getCours(symbole) {
    const symboleNormalise = symbole.toUpperCase();
    const reponse = await recupererJson(
      `${BASE_URL}/price/${encodeURIComponent(symboleNormalise)}`
    );

    const prixUsd = reponse?.price;

    if (typeof prixUsd !== 'number' || !Number.isFinite(prixUsd) || prixUsd <= 0) {
      throw new ErreurFournisseur(`gold-api n'a pas renvoyé de prix pour ${symboleNormalise}.`);
    }

    const tauxUsdEur = Number(await obtenirTauxUsdEur());

    if (!tauxUsdEur || tauxUsdEur <= 0) {
      throw new ErreurFournisseur(
        'Taux de change USD vers EUR indisponible, conversion du métal impossible.'
      );
    }

    return {
      symbole: symboleNormalise,
      cours_eur: (prixUsd * tauxUsdEur).toFixed(DECIMALES_PRIX),
      horodatage: reponse.updatedAt
        ? new Date(reponse.updatedAt).toISOString()
        : new Date().toISOString(),
      source: SOURCE,
    };
  }

  return { getCours, source: SOURCE };
}

module.exports = { creerAdaptateurMetal, BASE_URL, SOURCE };
