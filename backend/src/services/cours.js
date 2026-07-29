// Point d'entrée unique des cours. Tout le reste du back-end passe par ici : jamais
// par un adaptateur directement, et jamais par le cache directement.
//
// Les cours ne sont appelés que côté serveur (D6). Aucune URL de fournisseur ne
// remonte jusqu'au front, qui ne voit que la forme commune renvoyée ci-dessous.

const cacheCours = require('./cacheCours');
const { creerAdaptateurs } = require('../adaptateurs');
const { ErreurFournisseur } = require('../erreurs');

// Durées de vie du cache par classe d'actif (D21). Elles suivent le rythme réel de
// publication de chaque source : les taux BCE ne bougent qu'une fois par jour ouvré,
// une cryptomonnaie cote en continu. Regroupées ici, jamais recopiées ailleurs.
const DUREES_VIE_SECONDES = {
  crypto: 120,
  devise: 3600,
  metal: 600,
  // Préparé pour les actions, dont le fournisseur sera branché ultérieurement.
  action: 300,
};

const DUREE_VIE_PAR_DEFAUT = 300;

function creerServiceCours({ adaptateurs, cache = cacheCours } = {}) {
  // Référence au service lui-même, renseignée en fin de fonction. Elle permet à
  // l'adaptateur des métaux d'obtenir le taux de change en repassant par ce service,
  // donc par le cache, plutôt qu'en rappelant Frankfurter à chaque cours de métal.
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

    // 1. Le cache d'abord : un cours frais évite un appel sortant.
    const enCache = await cache.lireCoursCache(symboleNormalise);
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
        symboleNormalise,
        cours,
        DUREES_VIE_SECONDES[type] ?? DUREE_VIE_PAR_DEFAUT
      );
      await cache.ecrireDernierCoursConnu(symboleNormalise, cours);

      return { ...cours, source: 'fournisseur' };
    } catch (erreur) {
      // 4. Fournisseur indisponible : plutôt qu'une erreur, le dernier cours connu,
      // signalé comme tel avec son horodatage d'origine. Le front peut alors afficher
      // « dernier cours connu le ... », comportement prévu par cas-utilisation.md.
      const dernierConnu = await cache.lireDernierCoursConnu(symboleNormalise);

      if (dernierConnu) {
        console.error(
          `Cours ${symboleNormalise} indisponible, repli sur le dernier cours connu :`,
          erreur.message
        );
        return { ...dernierConnu, source: 'repli' };
      }

      // 5. Ni fournisseur ni repli : il n'y a rien à afficher, l'appelant doit le savoir.
      throw new ErreurFournisseur(
        `Cours indisponible pour ${symboleNormalise} et aucun cours connu en cache.`
      );
    }
  }

  // Le tableau de bord demandera plusieurs cours d'un coup. La déduplication évite
  // d'appeler deux fois le même symbole, cas fréquent lorsque plusieurs actifs
  // partagent une même devise de conversion.
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
