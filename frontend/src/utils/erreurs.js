import { ErreurApi } from '../services/api';

// Nature d'une erreur de chargement, telle que MessageErreur l'attend : le message
// affiché et le geste proposé en dépendent. Un statut 0 signale une requête restée sans
// réponse, donc un problème de connexion et non une erreur rendue par le serveur.
export function classifierErreurApi(erreur) {
  if (!(erreur instanceof ErreurApi)) {
    return 'api';
  }
  if (erreur.statut === 0) {
    return 'reseau';
  }
  return erreur.statut === 401 ? 'session' : 'api';
}
