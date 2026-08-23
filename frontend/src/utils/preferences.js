// Préférences d'affichage, conservées le temps de la session.
//
// Deux écrans les partagent déjà, le patrimoine et les positions, et l'écran de compte
// les proposera au réglage : les recopier à chaque fois aurait garanti qu'un jour l'un
// écrive sous une clé que l'autre ne lit pas.
//
// Le stockage de session et non le stockage local : le jeton ne survit pas au
// rechargement (D57), une préférence qui lui survivrait n'aurait pas de sens, et rien ne
// resterait sur un poste partagé après fermeture du navigateur.
//
// Toute lecture et toute écriture sont protégées : en navigation privée stricte, ou
// lorsque le navigateur refuse le stockage, l'accès lève une exception. L'écran doit
// alors fonctionner sans mémoire, pas cesser de s'afficher.

export const CLE_DEVISE = 'capitall.devise';
export const CLE_MASQUAGE = 'capitall.masquage';

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
    // Sans conséquence : seule la persistance est perdue, pas le comportement.
  }
}
