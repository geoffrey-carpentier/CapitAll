// Assemblage des adaptateurs et routage par type d'actif. Le service de cours appelle
// getCours(symbole) sans savoir quel fournisseur répond : en changer ne le touche pas.

const { recupererJson } = require('./clientHttp');
const { creerAdaptateurCoinbase } = require('./coinbase');
const { creerAdaptateurFrankfurter } = require('./frankfurter');
const { creerAdaptateurMetal } = require('./metal');
const { creerAdaptateurActions } = require('./actions');
const config = require('../config');
const { ErreurFournisseur } = require('../erreurs');

function creerAdaptateurs({ recupererJson: clientHttp = recupererJson, obtenirTauxUsdEur } = {}) {
  const coinbase = creerAdaptateurCoinbase({ recupererJson: clientHttp });
  const frankfurter = creerAdaptateurFrankfurter({ recupererJson: clientHttp });

  // Taux USD vers EUR des métaux : fourni par le service de cours (donc mis en cache) ;
  // l'appel direct à Frankfurter ne sert qu'aux usages isolés comme les tests.
  const metal = creerAdaptateurMetal({
    recupererJson: clientHttp,
    obtenirTauxUsdEur: obtenirTauxUsdEur ?? frankfurter.obtenirTauxUsdEur,
  });
  const actions = creerAdaptateurActions({
    recupererJson: clientHttp,
    obtenirTauxUsdEur: obtenirTauxUsdEur ?? frankfurter.obtenirTauxUsdEur,
    fmpApiKey: config.fmpApiKey,
    finnhubApiKey: config.finnhubApiKey,
    alphaVantageApiKey: config.alphaVantageApiKey,
  });

  const parType = {
    crypto: coinbase,
    devise: frankfurter,
    metal,
    action: actions,
  };
  function obtenirAdaptateur(type) {
    const adaptateur = parType[type];

    if (!adaptateur) {
      throw new ErreurFournisseur(`Fournisseur non branché pour le type d'actif « ${type} ».`);
    }

    return adaptateur;
  }

  return { obtenirAdaptateur, parType };
}

module.exports = { creerAdaptateurs };
