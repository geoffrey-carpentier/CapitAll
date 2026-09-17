import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// Ouverture de la feuille de création d'un seuil par l'adresse, comme `useMouvement` :
// `?seuil=nouveau` sans cible présélectionnée, `?seuil=12` sur l'actif 12.

export const PARAMETRE_SEUIL = 'seuil';
export const SEUIL_NOUVEAU = 'nouveau';

export function useSeuil() {
  const [parametres, setParametres] = useSearchParams();
  const ouvert = parametres.get(PARAMETRE_SEUIL);

  const ouvrir = useCallback(
    (actifId) => {
      const suivants = new URLSearchParams(parametres);
      suivants.set(PARAMETRE_SEUIL, actifId ? String(actifId) : SEUIL_NOUVEAU);
      setParametres(suivants, { replace: true });
    },
    [parametres, setParametres]
  );

  const fermer = useCallback(() => {
    const suivants = new URLSearchParams(parametres);
    suivants.delete(PARAMETRE_SEUIL);
    setParametres(suivants, { replace: true });
  }, [parametres, setParametres]);

  return {
    ouvert: ouvert !== null,
    cibleInitiale: ouvert === SEUIL_NOUVEAU ? 'capital_total' : ouvert,
    ouvrir,
    fermer,
  };
}
