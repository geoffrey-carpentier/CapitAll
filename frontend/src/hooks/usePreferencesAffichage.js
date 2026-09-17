import { useState } from 'react';
import { CLE_DEVISE, CLE_MASQUAGE, lirePreference, ecrirePreference } from '../utils/preferences';

// Devise d'affichage et masquage des montants, tels que chaque écran les propose.
//
// La lecture se fait au montage : une page relit le stockage de session en arrivant,
// ce qui suffit à retrouver le réglage d'une page à l'autre et après un rechargement.
// Deux écrans ne sont jamais montés en même temps, il n'y a donc rien à synchroniser.
//
// Si le navigateur refuse le stockage, l'écriture est perdue mais l'affichage suit
// quand même : l'état React est mis à jour dans tous les cas.
export function usePreferencesAffichage() {
  const [devise, setDevise] = useState(() => lirePreference(CLE_DEVISE, 'EUR'));
  const [masque, setMasque] = useState(() => lirePreference(CLE_MASQUAGE, 'non') === 'oui');

  function choisirDevise(choix) {
    setDevise(choix);
    ecrirePreference(CLE_DEVISE, choix);
  }

  function choisirMasquage(valeur) {
    setMasque(valeur);
    ecrirePreference(CLE_MASQUAGE, valeur ? 'oui' : 'non');
  }

  return { devise, choisirDevise, masque, choisirMasquage };
}
