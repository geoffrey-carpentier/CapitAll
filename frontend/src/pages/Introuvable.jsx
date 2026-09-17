import { Link } from 'react-router-dom';
import './Introuvable.css';

// Adresse inconnue, affichée dans la coquille comme les autres écrans. Le h1 est le
// titre de l'écran : la coquille n'en porte pas.
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
