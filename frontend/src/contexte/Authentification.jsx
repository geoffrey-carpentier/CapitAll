// Fournisseur d'authentification. Le jeton vit uniquement dans l'état React (D57) :
// il n'est écrit ni dans le stockage local, ni dans le stockage de session, ni dans
// un cookie. Un rafraîchissement de page déconnecte donc l'utilisateur.
//
// Ce comportement est assumé : un jeton conservé par le navigateur reste lisible par
// tout script injecté dans la page, ce qui est le principal scénario d'attaque sur une
// application manipulant des données patrimoniales. La contrepartie, se reconnecter
// après un rafraîchissement, est acceptable pour un usage de consultation.
//
// Le contexte et son hook d'accès vivent dans contexteAuthentification.js : ce fichier
// n'exporte qu'un composant, condition du rechargement à chaud.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, definirRappelSessionPerdue } from '../services/api';
import { ContexteAuthentification } from './contexteAuthentification';

export function FournisseurAuthentification({ children }) {
  const [jeton, setJeton] = useState(null);
  const [utilisateur, setUtilisateur] = useState(null);
  const [sessionExpiree, setSessionExpiree] = useState(false);

  const deconnecter = useCallback(() => {
    setJeton(null);
    setUtilisateur(null);
  }, []);

  // Une session perdue et une déconnexion volontaire vident toutes deux l'état, mais ne
  // se racontent pas de la même façon. La garde de routes renvoie vers la connexion dans
  // les deux cas ; sans ce drapeau, l'expiration serait une redirection silencieuse, et
  // l'utilisateur se retrouverait devant un formulaire sans savoir pourquoi.
  const signalerSessionPerdue = useCallback(() => {
    setSessionExpiree(true);
    deconnecter();
  }, [deconnecter]);

  // Le client d'API prévient d'un 401 : la session est perdue, l'état est vidé et la
  // garde de routes renvoie vers la connexion au rendu suivant.
  useEffect(() => {
    definirRappelSessionPerdue(signalerSessionPerdue);
    return () => definirRappelSessionPerdue(null);
  }, [signalerSessionPerdue]);

  const connecter = useCallback(async (identifiants) => {
    const reponse = await api.connexion(identifiants);
    setJeton(reponse.token);
    setUtilisateur(reponse.utilisateur);
    setSessionExpiree(false);
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
    () => ({
      jeton,
      utilisateur,
      estConnecte: Boolean(jeton),
      sessionExpiree,
      connecter,
      inscrire,
      deconnecter,
    }),
    [jeton, utilisateur, sessionExpiree, connecter, inscrire, deconnecter]
  );

  return (
    <ContexteAuthentification.Provider value={valeur}>{children}</ContexteAuthentification.Provider>
  );
}
