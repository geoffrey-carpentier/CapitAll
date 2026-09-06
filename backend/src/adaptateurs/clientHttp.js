// Client HTTP commun aux adaptateurs de cours. Il est injecté dans chaque factory
// plutôt qu'importé directement par les adaptateurs : c'est ce qui permet de les
// tester sans réseau, en fournissant une simple fonction à la place.

const { ErreurFournisseur } = require('../erreurs');

// Un fournisseur qui ne répond pas dans ce délai est considéré indisponible : la
// réponse à l'utilisateur passe alors par le dernier cours connu.
const DELAI_REQUETE_MS = 5000;

// Lecture d'une réponse JSON en préservant les chiffres reçus.
//
// JSON.parse rend un nombre à virgule flottante, et la précision est perdue à cet
// instant, avant tout traitement : le texte « 0.000000000123456789012345 » devient un
// double qui se réécrit « 1.23456789012345e-10 ». Aucune conversion ultérieure ne la
// récupère, pas même String(), qui ne restitue que le double. Le seul moment où les
// chiffres exacts existent encore est celui de la lecture du corps de la réponse.
//
// Chaque littéral numérique est donc entouré de guillemets dans le texte avant analyse :
// JSON.parse rend alors une chaîne portant les chiffres du fournisseur, que
// l'arithmétique en entiers du projet consomme sans perte. Un reviver ne conviendrait
// pas, il reçoit une valeur déjà convertie.
//
// L'analyse est faite à la main plutôt que par une expression régulière globale : un
// nombre écrit à l'intérieur d'une chaîne de caractères ne doit pas être touché, et
// distinguer les deux demande de suivre l'état « dans une chaîne ».
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
    // Coupure réseau, DNS, délai dépassé, JSON illisible : tous ramenés à une même
    // erreur métier, l'appelant n'ayant pas à connaître la cause technique.
    throw new ErreurFournisseur(`Fournisseur injoignable : ${erreur.message}`);
  } finally {
    clearTimeout(minuterie);
  }
}

module.exports = { recupererJson, analyserEnPreservantLesChiffres, DELAI_REQUETE_MS };
