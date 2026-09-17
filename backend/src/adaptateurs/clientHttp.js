// Client HTTP commun aux adaptateurs de cours, injecté pour les tester sans réseau.

const { ErreurFournisseur } = require('../erreurs');

// Au-delà, le fournisseur est considéré indisponible (repli sur le dernier cours connu).
const DELAI_REQUETE_MS = 5000;

// Lecture d'une réponse JSON en préservant les chiffres reçus.
//
// JSON.parse convertit les nombres en flottants et perd leur précision
// (« 0.000000000123456789012345 » devient « 1.23456789012345e-10 »), et un reviver
// reçoit une valeur déjà convertie. Chaque littéral numérique est donc mis entre
// guillemets avant l'analyse, pour être lu en chaîne.
//
// Parcours manuel plutôt qu'expression régulière : les nombres situés dans une chaîne
// ne doivent pas être touchés.
function analyserEnPreservantLesChiffres(texte) {
  const MOTIF_NOMBRE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/;

  let resultat = '';
  let position = 0;
  let dansChaine = false;

  while (position < texte.length) {
    const caractere = texte[position];

    if (dansChaine) {
      if (caractere === '\\') {
        resultat += caractere + (texte[position + 1] ?? '');
        position += 2;
        continue;
      }
      if (caractere === '"') {
        dansChaine = false;
      }
      resultat += caractere;
      position += 1;
      continue;
    }

    if (caractere === '"') {
      dansChaine = true;
      resultat += caractere;
      position += 1;
      continue;
    }

    if (caractere === '-' || (caractere >= '0' && caractere <= '9')) {
      const nombre = MOTIF_NOMBRE.exec(texte.slice(position));
      if (nombre) {
        resultat += `"${nombre[0]}"`;
        position += nombre[0].length;
        continue;
      }
    }

    resultat += caractere;
    position += 1;
  }

  return JSON.parse(resultat);
}

async function recupererJson(url, { delaiMs = DELAI_REQUETE_MS } = {}) {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), delaiMs);

  try {
    const reponse = await fetch(url, { signal: controleur.signal });

    if (!reponse.ok) {
      throw new ErreurFournisseur(`Le fournisseur a répondu ${reponse.status}.`);
    }

    return analyserEnPreservantLesChiffres(await reponse.text());
  } catch (erreur) {
    if (erreur instanceof ErreurFournisseur) {
      throw erreur;
    }
    // Réseau, DNS, délai ou JSON illisible : une seule erreur métier.
    throw new ErreurFournisseur(`Fournisseur injoignable : ${erreur.message}`);
  } finally {
    clearTimeout(minuterie);
  }
}

module.exports = { recupererJson, analyserEnPreservantLesChiffres, DELAI_REQUETE_MS };
