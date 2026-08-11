import './Montant.css';
import {
  formaterMontant,
  formaterQuantite,
  formaterCours,
  formaterTaux,
  formaterPourcentage,
  symboleDevise,
} from '../utils/formatage';

// Affiche une valeur numérique. C'est le seul point d'entrée de l'interface vers la
// politique de formatage : aucun écran ne met en forme un nombre par lui-même, ce qui
// rend la conformité vérifiable par une simple recherche des appels à ce composant.
//
// La valeur arrive toujours sous forme de chaîne, telle que l'API la renvoie. Lui faire
// traverser un nombre, même le temps d'un passage de propriété, suffirait à altérer une
// quantité à huit décimales.

const FORMATEURS = {
  montant: (valeur, _classe, _symbole, devise) => formaterMontant(valeur, { symbole: devise }),
  quantite: (valeur, classe, symbole) => formaterQuantite(valeur, classe, symbole),
  cours: (valeur, _classe, _symbole, devise) => formaterCours(valeur, { symbole: devise }),
  taux: (valeur) => formaterTaux(valeur),
  pourcentage: (valeur) => formaterPourcentage(valeur),
};

export default function Montant({
  valeur,
  type = 'montant',
  classe,
  symbole,
  devise = 'EUR',
  taille = 'corps',
  ...proprietes
}) {
  const formateur = FORMATEURS[type];
  const texte = formateur
    ? formateur(valeur, classe, symbole, symboleDevise(devise))
    : null;

  // Une valeur absente ou invalide s'affiche par un tiret cadratin plutôt que par un
  // zéro : « pas de donnée » et « zéro » ne se confondent pas sur un patrimoine.
  if (texte === null) {
    return (
      <span className={`montant montant--${taille} montant--indisponible`} {...proprietes}>
        <span aria-hidden="true">—</span>
        <span className="lecteur-ecran-seulement">valeur indisponible</span>
      </span>
    );
  }

  return (
    <span className={`montant montant--${taille}`} {...proprietes}>
      {texte}
    </span>
  );
}
