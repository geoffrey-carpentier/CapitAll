// Préférences d'affichage, conservées le temps de la session.
//
// Deux écrans les partagent déjà, le patrimoine et les positions, et l'écran de compte
// les proposera au réglage : les recopier à chaque fois aurait garanti qu'un jour l'un
// écrive sous une clé que l'autre ne lit pas.
//
// Le stockage de session et non le stockage local. Depuis la révision de D57, la session
// survit au rechargement mais pas à la fermeture de l'onglet : la préférence a donc
// exactement la même durée de vie que la session qu'elle accompagne, et rien ne reste sur
// un poste partagé une fois le navigateur fermé.
//
// Toute lecture et toute écriture sont protégées : en navigation privée stricte, ou
// lorsque le navigateur refuse le stockage, l'accès lève une exception. L'écran doit
// alors fonctionner sans mémoire, pas cesser de s'afficher.

// Les clés portent le nom du produit. Aucun repli sur les anciennes n'est prévu : le
// stockage de session disparaît à la fermeture de l'onglet, et un rechargement
// déconnecte déjà (D57). Une bascule ne peut donc perdre qu'une préférence d'onglet
// ouvert au moment de la mise en service, pour un code de compatibilité qui serait mort
// dès le lendemain.
export const CLE_DEVISE = 'walletwatch.devise';
export const CLE_MASQUAGE = 'walletwatch.masquage';

// La session vit au même endroit et pour la même durée que les préférences. Les
// fonctions ci-dessous lui servent aussi : elles ne savent rien de ce qu'elles portent,
// et le jeton n'a pas besoin d'un second mécanisme de stockage à côté du premier.
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
    // Sans conséquence : seule la persistance est perdue, pas le comportement.
  }
}

export function effacerPreference(cle) {
  try {
    window.sessionStorage.removeItem(cle);
  } catch {
    // Idem : l'entrée disparaîtra à la fermeture de l'onglet de toute façon.
  }
}
