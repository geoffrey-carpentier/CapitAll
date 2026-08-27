import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// Ouverture de la feuille de création d'un seuil, portée par l'adresse de l'écran
// d'origine. Même mécanique que `useMouvement` : la création n'est pas une page, elle se
// superpose à l'écran qui la demande, et l'adresse doit continuer à décrire ce qui est
// affiché après un rechargement.
//
// `?seuil=nouveau` ouvre la feuille sans cible présélectionnée ; `?seuil=12` l'ouvre sur
// l'actif d'identifiant 12, ce que fait l'écran de détail d'une position.

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
