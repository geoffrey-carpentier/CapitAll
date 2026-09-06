import { Link } from 'react-router-dom';
import './Introuvable.css';

// Adresse inconnue.
//
// La page était rendue hors de la coquille, avec ses styles écrits en ligne : elle
// n'avait ni navigation, ni la mise en page du reste de l'application, et paraissait
// appartenir à un autre site. Elle est désormais montée dans la coquille, comme les
// autres écrans, et n'a donc plus besoin de recomposer un fond ni un centrage de page.
//
// Le titre reste un h1 : c'est le titre de l'écran, la coquille n'en porte pas.
export default function Introuvable() {
  return (
    <section className="introuvable">
      <h1 className="introuvable__titre">Page introuvable</h1>
      <p className="introuvable__explication">
        Cette adresse ne correspond à aucun écran de l&apos;application.
      </p>
      <Link to="/patrimoine">Retour au patrimoine</Link>
    </section>
  );
}
