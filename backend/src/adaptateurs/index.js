// Assemblage des adaptateurs et routage par type d'actif.
//
// La logique métier appelle toujours getCours(symbole) sur l'adaptateur que lui rend
// ce module : elle ignore quel fournisseur répond, et un changement de fournisseur ne
// la touche pas (D5). Les actions utilisent ainsi leur chaîne de fournisseurs sans
// modifier le service de cours.

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

  // La conversion des métaux a besoin du taux USD vers EUR. En usage réel, le service
  // de cours injecte ici sa propre fonction, ce qui fait passer le taux par le cache
  // au lieu de rappeler Frankfurter à chaque cours de métal. Le repli sur l'adaptateur
  // direct ne sert qu'aux usages sans service, comme les tests d'adaptateur isolés.
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
