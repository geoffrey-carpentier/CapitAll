import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// Ouverture de la feuille de saisie d'un mouvement, portée par l'adresse de l'écran
// d'origine.
//
// La saisie n'est pas une page : elle se superpose à l'écran d'où elle est demandée, qui
// reste visible derrière elle. Elle ne peut donc pas avoir de route à elle. Mais elle ne
// peut pas non plus n'être qu'un état de composant : un rechargement la ferait
// disparaître, et l'adresse ne décrirait plus ce qui est affiché.
//
// Un paramètre de requête répond aux deux : `?mouvement=nouveau` ouvre la feuille sans
// actif présélectionné, `?mouvement=12` l'ouvre sur la position 12. C'est la même
// convention que les filtres et le tri de l'écran des positions.
//
// L'ouverture et la fermeture remplacent l'entrée d'historique au lieu d'en empiler une
// nouvelle : le bouton de retour du navigateur quitte alors l'écran, comme on l'attend,
// plutôt que de rejouer l'ouverture et la fermeture de la feuille.

export const PARAMETRE_MOUVEMENT = 'mouvement';
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

  const fermer = useCallback(() => {
    const suivants = new URLSearchParams(parametres);
    suivants.delete(PARAMETRE_MOUVEMENT);
    setParametres(suivants, { replace: true });
  }, [parametres, setParametres]);

  return {
    ouvert: ouvert !== null,
    // Un identifiant d'actif, ou null lorsque la feuille s'ouvre sans présélection.
    actifInitialId: ouvert === MOUVEMENT_NOUVEAU ? null : ouvert,
    ouvrir,
    fermer,
  };
}
