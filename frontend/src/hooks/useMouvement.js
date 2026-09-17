import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// Ouverture de la feuille de mouvement, portée par un paramètre de l'adresse.
//
// La feuille se superpose à l'écran d'origine et n'a donc pas de route, mais elle doit
// survivre à un rechargement :
// - `?mouvement=nouveau` l'ouvre sans actif présélectionné ;
// - `?mouvement=12` l'ouvre sur la position 12 ;
// - `?mouvement=12&correction=7` corrige le mouvement 7 de cette position.
//
// L'historique est remplacé et non empilé : le bouton retour quitte l'écran au lieu de
// rouvrir la feuille.

export const PARAMETRE_MOUVEMENT = 'mouvement';
export const PARAMETRE_CORRECTION = 'correction';
export const MOUVEMENT_NOUVEAU = 'nouveau';

export function useMouvement() {
  const [parametres, setParametres] = useSearchParams();
  const ouvert = parametres.get(PARAMETRE_MOUVEMENT);

  const ouvrir = useCallback(
    (actifId) => {
      const suivants = new URLSearchParams(parametres);
      suivants.set(PARAMETRE_MOUVEMENT, actifId ? String(actifId) : MOUVEMENT_NOUVEAU);
      setParametres(suivants, { replace: true });
    },
    [parametres, setParametres]
  );

  const corriger = useCallback(
    (actifId, idMouvement) => {
      const suivants = new URLSearchParams(parametres);
      suivants.set(PARAMETRE_MOUVEMENT, String(actifId));
      suivants.set(PARAMETRE_CORRECTION, String(idMouvement));
      setParametres(suivants, { replace: true });
    },
    [parametres, setParametres]
  );

  const fermer = useCallback(() => {
    const suivants = new URLSearchParams(parametres);
    suivants.delete(PARAMETRE_MOUVEMENT);
    suivants.delete(PARAMETRE_CORRECTION);
    setParametres(suivants, { replace: true });
  }, [parametres, setParametres]);

  return {
    ouvert: ouvert !== null,
    actifInitialId: ouvert === MOUVEMENT_NOUVEAU ? null : ouvert,
    // null en création.
    idCorrection: parametres.get(PARAMETRE_CORRECTION),
    ouvrir,
    corriger,
    fermer,
  };
}
