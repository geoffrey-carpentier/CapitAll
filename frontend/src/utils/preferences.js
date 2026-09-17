// Préférences d'affichage et session, partagées par tous les écrans.
//
// Stockage de session plutôt que local : les données survivent au rechargement mais pas
// à la fermeture de l'onglet, et rien ne reste sur un poste partagé.
//
// Chaque accès est protégé : si le navigateur refuse le stockage (navigation privée
// stricte), l'application fonctionne sans mémoire au lieu de planter.

export const CLE_DEVISE = 'walletwatch.devise';
export const CLE_MASQUAGE = 'walletwatch.masquage';

// La session utilise le même stockage et les mêmes fonctions que les préférences.
export const CLE_SESSION = 'walletwatch.session';

export function lirePreference(cle, valeurParDefaut) {
  try {
    return window.sessionStorage.getItem(cle) ?? valeurParDefaut;
  } catch {
    return valeurParDefaut;
  }
}

export function ecrirePreference(cle, valeur) {
  try {
    window.sessionStorage.setItem(cle, valeur);
  } catch {
    // Seule la persistance est perdue.
  }
}

export function effacerPreference(cle) {
  try {
    window.sessionStorage.removeItem(cle);
  } catch {
    // L'entrée disparaîtra de toute façon à la fermeture de l'onglet.
  }
}
