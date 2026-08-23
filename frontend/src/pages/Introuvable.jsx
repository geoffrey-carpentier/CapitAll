import { Link } from 'react-router-dom';

export default function Introuvable() {
  return (
    <main style={{ padding: 'var(--espace-8)', textAlign: 'center' }}>
      <h1 style={{ fontSize: 'var(--taille-montant)' }}>Page introuvable</h1>
      <p style={{ color: 'var(--couleur-texte-attenue)', margin: 'var(--espace-4) 0' }}>
        Cette adresse ne correspond à aucun écran de l'application.
      </p>
      <Link to="/patrimoine">Retour au patrimoine</Link>
    </main>
  );
}
