// Assemblage des adaptateurs et routage par type d'actif.
//
// La logique métier appelle toujours getCours(symbole) sur l'adaptateur que lui rend
// ce module : elle ignore quel fournisseur répond, et un changement de fournisseur ne
// la touche pas (D5). C'est ce qui permettra d'ajouter les actions sans modifier le
// service de cours.

const { recupererJson } = require('./clientHttp');
const { creerAdaptateurCoinbase } = require('./coinbase');
const { creerAdaptateurFrankfurter } = require('./frankfurter');
const { creerAdaptateurMetal } = require('./metal');
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

  const parType = {
    crypto: coinbase,
    devise: frankfurter,
    metal,
  };

  // Le type action est prévu au modèle mais son fournisseur n'est pas encore branché.
  // L'absence est signalée explicitement plutôt que rendue par un null silencieux,
  // qui provoquerait une erreur incompréhensible plus loin dans la chaîne.
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
