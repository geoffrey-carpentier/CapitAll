// Point d'entrée unique des cours : le reste du serveur ne passe jamais directement par
// un adaptateur ou par le cache. Les fournisseurs ne sont appelés que côté serveur.

const cacheCours = require('./cacheCours');
const { creerAdaptateurs } = require('../adaptateurs');
const { ErreurFournisseur } = require('../erreurs');

// Durées de vie du cache par classe, selon le rythme de publication de chaque source.
const DUREES_VIE_SECONDES = {
  crypto: 120,
  devise: 3600,
  metal: 600,
  // Les actions sont cotées en continu, mais les quotas gratuits imposent un cache
  // plus long que les cryptomonnaies.
  action: 300,
};

const DUREE_VIE_PAR_DEFAUT = 300;

function creerServiceCours({ adaptateurs, cache = cacheCours } = {}) {
  // Renseigné en fin de fonction : l'adaptateur des métaux obtient le taux USD/EUR par
  // ce service, donc par le cache.
  let service;

  const jeuAdaptateurs =
    adaptateurs ??
    creerAdaptateurs({
      obtenirTauxUsdEur: async () => {
        const cours = await service.getCours('USD', 'devise');
        return cours.cours_eur;
      },
    });

  async function getCours(symbole, type) {
    const symboleNormalise = symbole.toUpperCase();

    // 1. Le cache d'abord. La classe fait partie de la clé avec le symbole.
    const enCache = await cache.lireCoursCache(type, symboleNormalise);
    if (enCache) {
      return { ...enCache, source: 'cache' };
    }

    // 2. Sinon, le fournisseur correspondant au type d'actif.
    const adaptateur = jeuAdaptateurs.obtenirAdaptateur(type);

    try {
      const cours = await adaptateur.getCours(symboleNormalise);

      // 3. Deux écritures : le cours frais avec son TTL, et le filet de sécurité sans
      // expiration qui servira si le fournisseur tombe.
      await cache.ecrireCoursCache(
        type,
        symboleNormalise,
        cours,
        DUREES_VIE_SECONDES[type] ?? DUREE_VIE_PAR_DEFAUT
      );
      await cache.ecrireDernierCoursConnu(type, symboleNormalise, cours);

      return { ...cours, source: 'fournisseur' };
    } catch (erreur) {
      // 4. Fournisseur indisponible : dernier cours connu, signalé comme repli avec son
      // horodatage d'origine, et toujours pris dans la même classe.
      const dernierConnu = await cache.lireDernierCoursConnu(type, symboleNormalise);

      if (dernierConnu) {
        console.error(
          `Cours ${symboleNormalise} indisponible, repli sur le dernier cours connu :`,
          erreur.message
        );
        return { ...dernierConnu, source: 'repli' };
      }

      // 5. Ni fournisseur ni repli.
      throw new ErreurFournisseur(
        `Cours indisponible pour ${symboleNormalise} et aucun cours connu en cache.`
      );
    }
  }

  // Plusieurs cours d'un coup, dédupliqués par classe et symbole.
  async function getCoursMultiples(demandes) {
    const uniques = new Map();
    for (const { symbole, type } of demandes) {
      uniques.set(`${type}:${symbole.toUpperCase()}`, { symbole: symbole.toUpperCase(), type });
    }

    const resultats = await Promise.all(
      [...uniques.values()].map(async ({ symbole, type }) => {
        try {
          return await getCours(symbole, type);
        } catch (erreur) {
          // Un symbole en échec ne doit pas priver le tableau de bord des autres.
          return { symbole, type, erreur: erreur.message };
        }
      })
    );

    return resultats;
  }

  service = { getCours, getCoursMultiples };
  return service;
}

module.exports = { creerServiceCours, DUREES_VIE_SECONDES };
