// Vérification manuelle de la chaîne de récupération des cours : adaptateurs, cache
// et repli. Outil de mise au point et de démonstration, il n'expose aucune route et
// n'est pas chargé par le serveur.
//
//   node scripts/verifier-cours.js
//
// Lancé deux fois de suite, il montre le cache à l'œuvre : la première exécution
// affiche la source « fournisseur », la seconde « cache ».

const { creerServiceCours } = require('../src/services/cours');
const cacheRedis = require('../src/cache/client');

const SYMBOLES = [
  { symbole: 'BTC', type: 'crypto' },
  { symbole: 'USD', type: 'devise' },
  { symbole: 'XAU', type: 'metal' },
];

function formater(cours) {
  if (cours.erreur) {
    return `${cours.symbole.padEnd(5)} ECHEC     ${cours.erreur}`;
  }
  const valeur = `${Number(cours.cours_eur).toLocaleString('fr-FR')} EUR`;
  return `${cours.symbole.padEnd(5)} ${cours.source.padEnd(11)} ${valeur.padStart(18)}   ${cours.horodatage}`;
}

(async () => {
  const service = creerServiceCours();

  console.log('Symbole  Source          Cours en euros   Horodatage');
  console.log('-------  -----------  ----------------   ----------------------------');

  for (const demande of SYMBOLES) {
    try {
      const cours = await service.getCours(demande.symbole, demande.type);
      console.log(formater(cours));
    } catch (erreur) {
      console.log(`${demande.symbole.padEnd(5)} INDISPONIBLE  ${erreur.message}`);
    }
  }

  console.log('');
  console.log(`Cache Redis : ${cacheRedis.estDisponible() ? 'disponible' : 'indisponible'}`);

  await cacheRedis.fermer();
})();
