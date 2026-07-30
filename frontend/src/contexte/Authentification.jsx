// Contexte d'authentification. Le jeton vit uniquement dans l'état React (D57) :
// il n'est écrit ni dans le stockage local, ni dans le stockage de session, ni dans
// un cookie. Un rafraîchissement de page déconnecte donc l'utilisateur.
//
// Ce comportement est assumé : un jeton conservé par le navigateur reste lisible par
// tout script injecté dans la page, ce qui est le principal scénario d'attaque sur une
// application manipulant des données patrimoniales. La contrepartie, se reconnecter
// après un rafraîchissement, est acceptable pour un usage de consultation.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, definirRappelSessionPerdue } from '../services/api';

const ContexteAuthentification = createContext(null);

export function FournisseurAuthentification({ children }) {
  const [jeton, setJeton] = useState(null);
  const [utilisateur, setUtilisateur] = useState(null);

  const deconnecter = useCallback(() => {
    setJeton(null);
    setUtilisateur(null);
  }, []);

  // Le client d'API prévient d'un 401 : la session est perdue, l'état est vidé et la
  // garde de routes renvoie vers la connexion au rendu suivant.
  useEffect(() => {
    definirRappelSessionPerdue(deconnecter);
    return () => definirRappelSessionPerdue(null);
  }, [deconnecter]);

  const connecter = useCallback(async (identifiants) => {
    const reponse = await api.connexion(identifiants);
    setJeton(reponse.token);
    setUtilisateur(reponse.utilisateur);
    return reponse.utilisateur;
  }, []);

  // L'inscription enchaîne sur une connexion : l'utilisateur qui vient de créer son
  // compte n'a pas à saisir deux fois les mêmes identifiants.
  const inscrire = useCallback(
    async (donnees) => {
      await api.inscription(donnees);
      return connecter({ email: donnees.email, motDePasse: donnees.motDePasse });
    },
    [connecter]
  );

  const valeur = useMemo(
    () => ({ jeton, utilisateur, estConnecte: Boolean(jeton), connecter, inscrire, deconnecter }),
    [jeton, utilisateur, connecter, inscrire, deconnecter]
  );

  return (
    <ContexteAuthentification.Provider value={valeur}>{children}</ContexteAuthentification.Provider>
  );
}

export function useAuthentification() {
  const contexte = useContext(ContexteAuthentification);

  if (!contexte) {
    throw new Error(
      "useAuthentification doit être utilisé à l'intérieur de FournisseurAuthentification."
    );
  }

  return contexte;
}
