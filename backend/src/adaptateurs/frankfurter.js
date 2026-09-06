// Adaptateur Frankfurter : taux de change de référence publiés par la Banque centrale
// européenne. Sert à deux usages : le cours des devises étrangères suivies, et la
// conversion USD vers EUR dont dépend l'adaptateur des métaux.

const { ErreurFournisseur } = require('../erreurs');
const { chaineDecimalePositive } = require('./valeur');
const { ECHELLE_TAUX, versUnites, versChaine, diviser } = require('../utils/decimal');

const BASE_URL = 'https://api.frankfurter.dev/v1';
const SOURCE = 'frankfurter';

// Le nombre de décimales conservées après l'inversion est celui de l'échelle des taux
// (D88). La division n'a pas de résultat exact en général : elle est arrondie une fois,
// au plus proche, comme partout ailleurs.

// Frankfurter cote toujours à partir de l'euro : rates.USD vaut le nombre de dollars
// que vaut UN euro. Or un utilisateur qui détient des dollars veut savoir ce que vaut
// UN dollar en euros, soit l'inverse. Oublier cette inversion donnerait un cours
// faux d'un facteur proche de 1,3 sans que rien ne le signale.
//
// L'inversion se fait en entiers. Elle passait auparavant par une division flottante
// suivie d'un arrondi à huit décimales, alors que ce taux est appliqué à tout montant
// converti en dollars et sert aussi à ramener en euros les cours des métaux et des
// actions : c'est la valeur la plus réutilisée de toute la chaîne, et la moins bien
// placée pour porter une approximation.
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
      // La date du taux est remontée telle quelle. Les taux BCE n'étant publiés que
      // les jours ouvrés, elle est régulièrement antérieure au jour courant : c'est
      // le fonctionnement normal du service, pas un signe d'indisponibilité.
      horodatage: reponse.date ? new Date(reponse.date).toISOString() : new Date().toISOString(),
      source: SOURCE,
    };
  }

  // Exposé séparément parce que l'adaptateur des métaux en a besoin pour convertir un
  // prix libellé en dollars, sans redemander lui-même le taux au fournisseur.
  async function obtenirTauxUsdEur() {
    const cours = await getCours('USD');
    return cours.cours_eur;
  }

  return { getCours, obtenirTauxUsdEur, source: SOURCE };
}

module.exports = { creerAdaptateurFrankfurter, inverserTaux, BASE_URL, SOURCE };
