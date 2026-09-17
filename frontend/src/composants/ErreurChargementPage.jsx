import { useNavigate } from 'react-router-dom';
import MessageErreur from './MessageErreur';
import { classifierErreurApi } from '../utils/erreurs';

// Écran d'une page dont le chargement initial a échoué : le titre reste affiché, seul le
// contenu est remplacé par l'erreur. Une session perdue mène à la connexion plutôt qu'à
// un nouvel essai, qui échouerait à l'identique.
//
// Réservé à l'échec du premier chargement. Une erreur survenue après coup s'affiche au
// milieu des données déjà lisibles, ce que chaque page traite à sa manière.
export default function ErreurChargementPage({ page, titre, erreur, surReessayer }) {
  const naviguer = useNavigate();
  const nature = classifierErreurApi(erreur);

  return (
    <div className={page}>
      <h1 className={`${page}__titre`}>{titre}</h1>
      <MessageErreur
        nature={nature}
        message={nature === 'api' ? erreur.message : undefined}
        libelleAction={nature === 'session' ? 'Se reconnecter' : 'Réessayer'}
        surAction={nature === 'session' ? () => naviguer('/connexion') : surReessayer}
      />
    </div>
  );
}
