// Adaptateur Coinbase : cours des cryptomonnaies, directement en euros.
// Endpoint public, sans authentification.
//
// Factory : le client HTTP est reçu en paramètre, aucun appel réseau n'est écrit en
// dur ici. L'adaptateur est ainsi testable sans réseau.

const { ErreurFournisseur } = require('../erreurs');

const BASE_URL = 'https://api.coinbase.com/v2';
const SOURCE = 'coinbase';

function creerAdaptateurCoinbase({ recupererJson }) {
  async function getCours(symbole) {
    const symboleNormalise = symbole.toUpperCase();
    const reponse = await recupererJson(
      `${BASE_URL}/exchange-rates?currency=${encodeURIComponent(symboleNormalise)}`
    );

    // La réponse contient plusieurs centaines de paires pour un seul symbole.
    // Seule la ligne EUR est extraite ici : le reste ne quitte jamais le serveur.
    const taux = reponse?.data?.rates?.EUR;

    if (!taux) {
      throw new ErreurFournisseur(
        `Coinbase n'a pas renvoyé de cours en euros pour ${symboleNormalise}.`
      );
    }

    return {
      symbole: symboleNormalise,
      // La valeur est déjà une chaîne côté Coinbase : elle est conservée telle quelle,
      // sans passer par Number, pour ne pas introduire d'imprécision (D4).
      cours_eur: String(taux),
      horodatage: new Date().toISOString(),
      source: SOURCE,
    };
  }

  return { getCours, source: SOURCE };
}

module.exports = { creerAdaptateurCoinbase, BASE_URL, SOURCE };
