import { useAuthentification } from '../contexte/Authentification';
import Carte from '../composants/Carte';

// Écran provisoire. Le tableau de bord réel, avec ses indicateurs, son anneau de
// répartition et sa courbe d'évolution, est développé au lot suivant.
export default function TableauDeBord() {
  const { utilisateur } = useAuthentification();

  return (
    <>
      <h1>Tableau de bord</h1>
      <p style={{ color: 'var(--couleur-texte-attenue)', marginBottom: 'var(--espace-6)' }}>
        Bonjour {utilisateur?.pseudo ?? 'et bienvenue'}.
      </p>

      <Carte titre="Interface en cours de construction">
        <p>
          Le socle est en place : authentification, navigation et composants de base. Les
          indicateurs, la répartition par classe d'actif et la courbe d'évolution arrivent
          au prochain lot.
        </p>
      </Carte>
    </>
  );
}
