// Fournisseur d'authentification.
//
// D57 conservait le jeton dans le seul état React : un rafraîchissement de page
// déconnectait. Le motif était juste — un jeton lisible par un script injecté est le
// principal scénario d'attaque sur une application patrimoniale — mais la contrepartie
// s'est révélée coûteuse à l'usage : recharger une fiche, revenir en arrière, ou
// simplement rouvrir l'onglet renvoyait au formulaire de connexion.
//
// La décision est révisée en L4 parce que les deux pièces qui manquaient sont désormais
// là. La page est servie sous une politique de sécurité du contenu qui interdit tout
// script en ligne, ce qui referme la voie d'injection que D57 redoutait. Et un jeton
// dérobé n'est plus valable jusqu'à son expiration : changer son mot de passe pose une
// borne de révocation qui l'invalide dans la seconde.
//
// Le jeton passe donc dans le **stockage de session**, et non dans le stockage local :
// il survit au rechargement et à la navigation, il ne survit pas à la fermeture de
// l'onglet. C'est le changement minimal qui règle le défaut constaté sans rien concéder
// de plus — rien ne reste derrière l'utilisateur sur un poste partagé.
//
// Le contexte et son hook d'accès vivent dans contexteAuthentification.js : ce fichier
// n'exporte qu'un composant, condition du rechargement à chaud.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, definirRappelSessionPerdue } from '../services/api';
import { lirePreference, ecrirePreference, effacerPreference, CLE_SESSION } from '../utils/preferences';
import { ContexteAuthentification } from './contexteAuthentification';

// La session relue au démarrage. Une entrée illisible — écriture partielle, format
// changé — est traitée comme une absence de session : mieux vaut redemander une
// connexion que de partir avec un état à moitié reconstitué.
function lireSession() {
  const brut = lirePreference(CLE_SESSION, null);

  if (!brut) {
    return null;
  }

  try {
    const session = JSON.parse(brut);
    return session?.jeton ? session : null;
  } catch {
    effacerPreference(CLE_SESSION);
    return null;
  }
}

export function FournisseurAuthentification({ children }) {
  const [session, setSession] = useState(lireSession);
  const jeton = session?.jeton ?? null;
  const utilisateur = session?.utilisateur ?? null;
  const [sessionExpiree, setSessionExpiree] = useState(false);

  // L'écriture est faite ici plutôt qu'à chaque endroit qui change la session : un seul
  // point d'écriture, et l'état React reste la source, le stockage n'en étant que le
  // reflet.
  const memoriser = useCallback((suivante) => {
    setSession(suivante);
    if (suivante) {
      ecrirePreference(CLE_SESSION, JSON.stringify(suivante));
    } else {
      effacerPreference(CLE_SESSION);
    }
  }, []);

  const deconnecter = useCallback(() => {
    memoriser(null);
  }, [memoriser]);

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

  const connecter = useCallback(
    async (identifiants) => {
      const reponse = await api.connexion(identifiants);
      memoriser({ jeton: reponse.token, utilisateur: reponse.utilisateur });
      setSessionExpiree(false);
      return reponse.utilisateur;
    },
    [memoriser]
  );

  // Changer son mot de passe révoque les jetons antérieurs, celui de la session en cours
  // compris : le serveur en remet un neuf, et c'est lui qu'il faut retenir. Sans cela,
  // l'utilisateur serait déconnecté par l'opération qu'il vient de réussir.
  const remplacerJeton = useCallback(
    (nouveauJeton) => {
      setSession((precedente) => {
        if (!precedente) {
          return precedente;
        }
        const suivante = { ...precedente, jeton: nouveauJeton };
        ecrirePreference(CLE_SESSION, JSON.stringify(suivante));
        return suivante;
      });
    },
    []
  );

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
      remplacerJeton,
    }),
    [jeton, utilisateur, sessionExpiree, connecter, inscrire, deconnecter, remplacerJeton]
  );

  return (
    <ContexteAuthentification.Provider value={valeur}>{children}</ContexteAuthentification.Provider>
  );
}
