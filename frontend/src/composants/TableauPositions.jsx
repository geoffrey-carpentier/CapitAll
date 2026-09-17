import { Link } from 'react-router-dom';
import './TableauPositions.css';
import Montant from './Montant';
import Variation from './Variation';
import JetonClasse from './JetonClasse';
import PastilleFraicheur from './PastilleFraicheur';
import CourbeMiniature from './CourbeMiniature';
import { LIBELLES_CLASSE } from '../utils/classesActifs';
import { formaterMontant, symboleDevise } from '../utils/formatage';

// Liste des positions : liste de liens en mobile, tableau à colonnes en desktop.
//
// Les deux structures sont dans le document et le CSS n'en affiche qu'une. La structure
// masquée l'est par `display: none`, ce qui la retire aussi de l'arbre d'accessibilité :
// rien n'est annoncé deux fois.

const COLONNES = [
  { cle: 'nom', libelle: 'Actif', triable: false },
  { cle: 'quantite_detenue', libelle: 'Quantité', triable: true, numerique: true },
  { cle: 'cours_eur', libelle: 'Cours', triable: true, numerique: true },
  { cle: 'pru', libelle: 'Prix de revient', triable: true, numerique: true },
  { cle: 'valeur', libelle: 'Valorisation', triable: true, numerique: true },
  { cle: 'plus_value_latente', libelle: 'Plus-value', triable: true, numerique: true },
  // Tendance sur trente jours, absente de la liste mobile faute de place.
  { cle: 'tendance', libelle: '30 jours', triable: true, numerique: true },
];

// aria-sort n'est actif que sur la colonne triée.
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
      {/* Rendu mobile : chaque lien annonce l'actif et sa valorisation. */}
      <ul className="positions-liste__cartes">
        {positions.map((position) => (
          <li key={position.id}>
            <Link
              to={`/positions/${position.id}`}
              className="positions-liste__carte"
              aria-label={libelleAccessible(position, devise, masque)}
            >
              <span className="positions-liste__identite">
                <JetonClasse classe={position.type} symbole={position.symbole} />
                <span>
                  <span className="positions-liste__nom">{position.nom}</span>
                  <span className="positions-liste__detail">
                    {masque ? (
                      <span className="positions-liste__masque">•••• {position.symbole}</span>
                    ) : (
                      <Montant
                        valeur={position.quantite_detenue}
                        type="quantite"
                        classe={position.type}
                        symbole={position.symbole}
                        taille="legende"
                      />
                    )}
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

      {/* Rendu desktop : en-têtes en boutons, pour trier au clavier. */}
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
                  <JetonClasse classe={position.type} symbole={position.symbole} />
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
                {masque ? (
                  `•••• ${position.symbole}`
                ) : (
                  <Montant
                    valeur={position.quantite_detenue}
                    type="quantite"
                    classe={position.type}
                    symbole={position.symbole}
                  />
                )}
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
              {/* Variation relative : non masquée, comme les autres pourcentages. */}
              <td className="positions-liste__colonne-nombre">
                <CourbeMiniature tendance={position.tendance_30j} />
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

// Nom accessible du lien : actif, classe et valorisation, compréhensible hors contexte.
function libelleAccessible(position, devise, masque) {
  const classe = LIBELLES_CLASSE[position.type] ?? position.type;

  if (masque || position.valeur === null) {
    return `${position.nom}, ${classe}`;
  }

  // Même formatage qu'à l'écran.
  const valeur = formaterMontant(position.valeur, { symbole: symboleDevise(devise) });
  return `${position.nom}, ${classe}, valorisée ${valeur}`;
}
