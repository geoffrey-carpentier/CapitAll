// Contexte d'authentification et hook d'accès, séparés du fournisseur pour préserver le
// rechargement à chaud.

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
