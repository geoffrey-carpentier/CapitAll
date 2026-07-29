// Client HTTP commun aux adaptateurs de cours. Il est injecté dans chaque factory
// plutôt qu'importé directement par les adaptateurs : c'est ce qui permet de les
// tester sans réseau, en fournissant une simple fonction à la place.

const { ErreurFournisseur } = require('../erreurs');

// Un fournisseur qui ne répond pas dans ce délai est considéré indisponible : la
// réponse à l'utilisateur passe alors par le dernier cours connu.
const DELAI_REQUETE_MS = 5000;

async function recupererJson(url, { delaiMs = DELAI_REQUETE_MS } = {}) {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), delaiMs);

  try {
    const reponse = await fetch(url, { signal: controleur.signal });

    if (!reponse.ok) {
      throw new ErreurFournisseur(`Le fournisseur a répondu ${reponse.status}.`);
    }

    return await reponse.json();
  } catch (erreur) {
    if (erreur instanceof ErreurFournisseur) {
      throw erreur;
    }
    // Coupure réseau, DNS, délai dépassé, JSON illisible : tous ramenés à une même
    // erreur métier, l'appelant n'ayant pas à connaître la cause technique.
    throw new ErreurFournisseur(`Fournisseur injoignable : ${erreur.message}`);
  } finally {
    clearTimeout(minuterie);
  }
}

module.exports = { recupererJson, DELAI_REQUETE_MS };
