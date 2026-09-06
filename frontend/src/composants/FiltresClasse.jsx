import './FiltresClasse.css';
import JetonClasse from './JetonClasse';
import { LIBELLES_CLASSE } from '../utils/classesActifs';
import { CLASSES_QUANTITE } from '../utils/formatage';

// Filtres par classe d'actif, cumulables, chacun portant le nombre de positions qu'il
// laisserait passer.
//
// Le compteur n'est pas un ornement : sans lui, l'utilisateur ne sait pas si activer un
// filtre videra la liste, et découvre l'absence de résultat après coup. Il est calculé
// sur la totalité des positions, jamais sur ce qui reste après les autres filtres, sans
// quoi les nombres changeraient à chaque clic et cesseraient d'être des repères.
//
// Une classe absente du portefeuille n'a pas de bouton : proposer un filtre qui ne peut
// mener qu'à une liste vide n'aide personne.
//
// Ce sont des boutons à `aria-pressed` et non des cases à cocher : ils ne composent pas
// une saisie, ils commutent l'affichage.
export default function FiltresClasse({ positions = [], actives = [], surBascule }) {
  const compteurs = positions.reduce((total, position) => {
    total[position.type] = (total[position.type] ?? 0) + 1;
    return total;
  }, {});

  const classes = CLASSES_QUANTITE.filter((classe) => compteurs[classe] > 0);

  if (classes.length < 2) {
    return null;
  }

  return (
    <div className="filtres-classe" role="group" aria-label="Filtrer par classe d'actif">
      {classes.map((classe) => {
        const active = actives.includes(classe);
        const libelle = LIBELLES_CLASSE[classe] ?? classe;

        return (
          <button
            key={classe}
            type="button"
            aria-pressed={active}
            aria-label={`${libelle}, ${compteurs[classe]} position${compteurs[classe] > 1 ? 's' : ''}`}
            className={`filtres-classe__bouton${active ? ' filtres-classe__bouton--actif' : ''}`}
            onClick={() => surBascule?.(classe)}
          >
            <JetonClasse classe={classe} />
            <span aria-hidden="true">{libelle}</span>
            <span className="filtres-classe__compteur" aria-hidden="true">
              {compteurs[classe]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
