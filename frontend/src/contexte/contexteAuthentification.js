// Contexte d'authentification et hook d'accès.
//
// Séparés du fournisseur, qui est un composant : un module qui exporte à la fois des
// composants et des valeurs empêche le rechargement à chaud de fonctionner
// correctement pendant le développement.

import { createContext, useContext } from 'react';

export const ContexteAuthentification = createContext(null);

export function useAuthentification() {
  const contexte = useContext(ContexteAuthentification);

  if (!contexte) {
    throw new Error(
      "useAuthentification doit être utilisé à l'intérieur de FournisseurAuthentification."
    );
  }

  return contexte;
}
