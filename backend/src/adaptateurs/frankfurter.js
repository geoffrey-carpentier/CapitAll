// Adaptateur Frankfurter : taux de change de référence publiés par la Banque centrale
// européenne. Sert à deux usages : le cours des devises étrangères suivies, et la
// conversion USD vers EUR dont dépend l'adaptateur des métaux.

const { ErreurFournisseur } = require('../erreurs');

const BASE_URL = 'https://api.frankfurter.dev/v1';
const SOURCE = 'frankfurter';

// Nombre de décimales conservées après l'inversion du taux. La division n'a pas de
// résultat exact en général : on fixe une précision suffisante pour un cours de
// change, puis on retire les zéros inutiles.
const DECIMALES_TAUX = 8;

// Frankfurter cote toujours à partir de l'euro : rates.USD vaut le nombre de dollars
// que vaut UN euro. Or un utilisateur qui détient des dollars veut savoir ce que vaut
// UN dollar en euros, soit l'inverse. Oublier cette inversion donnerait un cours
// faux d'un facteur proche de 1,3 sans que rien ne le signale.
function inverserTaux(tauxDepuisEuro) {
  const inverse = 1 / tauxDepuisEuro;
  return inverse.toFixed(DECIMALES_TAUX).replace(/\.?0+$/, '');
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

    const tauxDepuisEuro = reponse?.rates?.[symboleNormalise];

    if (!tauxDepuisEuro || tauxDepuisEuro <= 0) {
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
