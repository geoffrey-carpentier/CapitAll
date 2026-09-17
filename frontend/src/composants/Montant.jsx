import './Montant.css';
import {
  formaterMontant,
  formaterQuantite,
  formaterCours,
  formaterTaux,
  formaterPourcentage,
  symboleDevise,
} from '../utils/formatage';

// Affichage d'une valeur numérique par le module de formatage.
//
// La valeur reste la chaîne renvoyée par l'API : la convertir en nombre, même pour la
// transmettre, altérerait une quantité à dix-huit décimales.

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

  // Valeur absente ou invalide : un tiret, jamais un zéro.
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
