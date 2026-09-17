// Adaptateur Coinbase : cours des cryptomonnaies en euros, par un endpoint public. Le
// client HTTP est injecté pour tester sans réseau.

const { ErreurFournisseur } = require('../erreurs');

const BASE_URL = 'https://api.coinbase.com/v2';
const SOURCE = 'coinbase';

function creerAdaptateurCoinbase({ recupererJson }) {
  async function getCours(symbole) {
    const symboleNormalise = symbole.toUpperCase();
    const reponse = await recupererJson(
      `${BASE_URL}/exchange-rates?currency=${encodeURIComponent(symboleNormalise)}`
    );

    // Seule la paire EUR est extraite parmi les centaines renvoyées.
    const taux = reponse?.data?.rates?.EUR;

    if (!taux) {
      throw new ErreurFournisseur(
        `Coinbase n'a pas renvoyé de cours en euros pour ${symboleNormalise}.`
      );
    }

    return {
      symbole: symboleNormalise,
      // Chaîne conservée telle quelle, sans passer par Number.
      cours_eur: String(taux),
      horodatage: new Date().toISOString(),
      source: SOURCE,
    };
  }

  return { getCours, source: SOURCE };
}

module.exports = { creerAdaptateurCoinbase, BASE_URL, SOURCE };
