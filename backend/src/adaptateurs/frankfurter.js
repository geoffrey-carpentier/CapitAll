// Adaptateur Frankfurter (taux de référence BCE) : cours des devises suivies et taux
// USD vers EUR utilisé pour les métaux.

const { ErreurFournisseur } = require('../erreurs');
const { chaineDecimalePositive } = require('./valeur');
const { ECHELLE_TAUX, versUnites, versChaine, diviser } = require('../utils/decimal');

const BASE_URL = 'https://api.frankfurter.dev/v1';
const SOURCE = 'frankfurter';

// Frankfurter cote depuis l'euro (rates.USD = dollars pour un euro) : le cours d'une
// devise en euros est l'inverse. Division exacte en entiers, arrondie une fois à
// l'échelle des taux, car ce taux sert aussi à convertir métaux et actions.
function inverserTaux(tauxDepuisEuro) {
  const taux = versUnites(tauxDepuisEuro, ECHELLE_TAUX);

  if (taux === 0n) {
    return null;
  }

  return versChaine(
    diviser(versUnites('1', ECHELLE_TAUX), ECHELLE_TAUX, taux, ECHELLE_TAUX, ECHELLE_TAUX),
    ECHELLE_TAUX
  );
}

function creerAdaptateurFrankfurter({ recupererJson }) {
  async function getCours(symbole) {
    const symboleNormalise = symbole.toUpperCase();

    // Cas particulier : l'euro est la devise de référence, il vaut toujours 1.
    if (symboleNormalise === 'EUR') {
      return {
        symbole: 'EUR',
        cours_eur: '1',
        horodatage: new Date().toISOString(),
        source: SOURCE,
      };
    }

    const reponse = await recupererJson(
      `${BASE_URL}/latest?base=EUR&symbols=${encodeURIComponent(symboleNormalise)}`
    );

    const tauxDepuisEuro = chaineDecimalePositive(reponse?.rates?.[symboleNormalise]);

    if (tauxDepuisEuro === null) {
      throw new ErreurFournisseur(`Frankfurter n'a pas renvoyé de taux pour ${symboleNormalise}.`);
    }

    return {
      symbole: symboleNormalise,
      cours_eur: inverserTaux(tauxDepuisEuro),
      // Taux BCE publiés les jours ouvrés : une date antérieure au jour est normale.
      horodatage: reponse.date ? new Date(reponse.date).toISOString() : new Date().toISOString(),
      source: SOURCE,
    };
  }

  // Utilisé pour convertir un prix libellé en dollars.
  async function obtenirTauxUsdEur() {
    const cours = await getCours('USD');
    return cours.cours_eur;
  }

  return { getCours, obtenirTauxUsdEur, source: SOURCE };
}

module.exports = { creerAdaptateurFrankfurter, inverserTaux, BASE_URL, SOURCE };
