import { Link } from 'react-router-dom';
import './TableauPositions.css';
import Montant from './Montant';
import Variation from './Variation';
import JetonClasse from './JetonClasse';
import PastilleFraicheur from './PastilleFraicheur';
import { LIBELLES_CLASSE } from '../utils/classesActifs';
import { formaterMontant, symboleDevise } from '../utils/formatage';

// Liste des positions détenues.
//
// Deux rendus pour une même donnée, et non deux composants. Sous le point de rupture,
// une liste de liens à deux niveaux : la lecture se fait au pouce, une ligne à la fois.
// Au-dessus, un vrai tableau à colonnes, parce que c'est la comparaison entre lignes qui
// devient l'usage principal dès qu'on a la place de les aligner.
//
// Le choix entre les deux se fait en CSS et non par une mesure de la fenêtre en
// JavaScript : les deux structures sont dans le document, une seule est affichée. Cela
// coûte quelques nœuds et évite un rendu qui saute au redimensionnement.
//
// Aucune des deux n'est annoncée deux fois : la structure écartée l'est par
// `display: none`, ce qui la retire aussi de l'arbre d'accessibilité. C'est ce qui rend
// ce doublon acceptable ; il ne le serait pas avec une mise en retrait visuelle.

const COLONNES = [
  { cle: 'nom', libelle: 'Actif', triable: false },
  { cle: 'quantite_detenue', libelle: 'Quantité', triable: true, numerique: true },
  { cle: 'cours_eur', libelle: 'Cours', triable: true, numerique: true },
  { cle: 'pru', libelle: 'Prix de revient', triable: true, numerique: true },
  { cle: 'valeur', libelle: 'Valorisation', triable: true, numerique: true },
  { cle: 'plus_value_latente', libelle: 'Plus-value', triable: true, numerique: true },
];

// aria-sort ne se pose que sur la colonne effectivement triée : l'annoncer sur toutes
// laisserait entendre que la liste est triée sur plusieurs critères à la fois.
function etatDuTri(colonne, tri) {
  if (!colonne.triable) {
    return undefined;
  }
  if (tri.cle !== colonne.cle) {
    return 'none';
  }
  return tri.descendant ? 'descending' : 'ascending';
}

export default function TableauPositions({
  positions = [],
  devise = 'EUR',
  masque = false,
  tri = { cle: 'valeur', descendant: true },
  surTri,
}) {
  return (
    <div className="positions-liste">
      {/* Rendu mobile : une liste de liens. Chaque lien porte le nom de l'actif et sa
          valorisation, jamais un « voir » isolé qui n'apprendrait rien hors contexte. */}
      <ul className="positions-liste__cartes">
        {positions.map((position) => (
          <li key={position.id}>
            <Link
              to={`/positions/${position.id}`}
              className="positions-liste__carte"
              aria-label={libelleAccessible(position, devise, masque)}
            >
              <span className="positions-liste__identite">
                <JetonClasse classe={position.type} />
                <span>
                  <span className="positions-liste__nom">{position.nom}</span>
                  <span className="positions-liste__detail">
                    <Montant
                      valeur={position.quantite_detenue}
                      type="quantite"
                      classe={position.type}
                      symbole={position.symbole}
                      taille="legende"
                    />
                    {position.source_cours === 'repli' && (
                      <PastilleFraicheur
                        source={position.source_cours}
                        horodatage={position.horodatage_cours}
                        enRepli
                      />
                    )}
                  </span>
                </span>
              </span>

              <span className="positions-liste__chiffres" aria-hidden="true">
                {masque ? (
                  <span className="positions-liste__masque">••••</span>
                ) : (
                  <Montant valeur={position.valeur} devise={devise} />
                )}
                <Variation valeur={position.pourcentage_variation} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Rendu desktop : tableau sémantique, en-têtes portées par des boutons pour que
          le tri soit atteignable au clavier comme n'importe quelle commande. */}
      <table className="positions-liste__tableau">
        <caption className="lecteur-ecran-seulement">
          Positions détenues, triées par {libelleColonne(tri.cle)}{' '}
          {tri.descendant ? 'par ordre décroissant' : 'par ordre croissant'}.
        </caption>
        <thead>
          <tr>
            {COLONNES.map((colonne) => (
              <th
                key={colonne.cle}
                scope="col"
                aria-sort={etatDuTri(colonne, tri)}
                className={colonne.numerique ? 'positions-liste__colonne-nombre' : undefined}
              >
                {colonne.triable ? (
                  <button
                    type="button"
                    className="positions-liste__tri"
                    onClick={() => surTri?.(colonne.cle)}
                  >
                    {colonne.libelle}
                    <span aria-hidden="true">
                      {tri.cle === colonne.cle ? (tri.descendant ? ' ▼' : ' ▲') : ''}
                    </span>
                  </button>
                ) : (
                  colonne.libelle
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.id}>
              <th scope="row" className="positions-liste__cellule-actif">
                <Link to={`/positions/${position.id}`} className="positions-liste__lien">
                  <JetonClasse classe={position.type} />
                  <span>
                    <span className="positions-liste__nom">{position.nom}</span>
                    <span className="positions-liste__symbole">{position.symbole}</span>
                  </span>
                </Link>
                {position.source_cours === 'repli' && (
                  <PastilleFraicheur
                    source={position.source_cours}
                    horodatage={position.horodatage_cours}
                    enRepli
                  />
                )}
              </th>
              <td className="positions-liste__colonne-nombre">
                <Montant
                  valeur={position.quantite_detenue}
                  type="quantite"
                  classe={position.type}
                  symbole={position.symbole}
                />
              </td>
              <td className="positions-liste__colonne-nombre">
                {masque ? '••••' : <Montant valeur={position.cours_eur} type="cours" devise={devise} />}
              </td>
              <td className="positions-liste__colonne-nombre">
                {masque ? '••••' : <Montant valeur={position.pru} type="cours" devise={devise} />}
              </td>
              <td className="positions-liste__colonne-nombre">
                {masque ? '••••' : <Montant valeur={position.valeur} devise={devise} />}
              </td>
              <td className="positions-liste__colonne-nombre">
                {masque ? (
                  '••••'
                ) : (
                  <Variation
                    valeur={position.plus_value_latente}
                    mode="absolue"
                    devise={devise}
                    amplitude={position.pourcentage_variation}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function libelleColonne(cle) {
  return COLONNES.find((colonne) => colonne.cle === cle)?.libelle ?? cle;
}

// Texte annoncé pour le lien d'une position. Il nomme l'actif, sa classe et sa
// valorisation : hors contexte, dans une liste de liens parcourue à la voix, c'est ce
// qui permet de choisir sans avoir à explorer chaque ligne.
function libelleAccessible(position, devise, masque) {
  const classe = LIBELLES_CLASSE[position.type] ?? position.type;

  if (masque || position.valeur === null) {
    return `${position.nom}, ${classe}`;
  }

  // Même mise en forme que la valeur affichée : ce qui est lu à la voix et ce qui est lu
  // à l'écran doivent être le même nombre, sans quoi les deux se contrediraient.
  const valeur = formaterMontant(position.valeur, { symbole: symboleDevise(devise) });
  return `${position.nom}, ${classe}, valorisée ${valeur}`;
}
