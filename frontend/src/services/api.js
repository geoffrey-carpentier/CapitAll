// Point de passage unique vers le serveur. Aucun composant n'appelle fetch
// directement : l'en-tête d'autorisation, le traitement des erreurs et la perte de
// session sont donc traités à un seul endroit.
//
// Les appels partent en chemin relatif : en développement, le serveur de Vite les
// redirige vers l'API (voir vite.config.js) ; en production, l'interface et l'API
// sont servies sous la même origine. Aucune adresse d'API n'a donc à figurer ici.

const BASE = '/api';

// Rappel posé par le contexte d'authentification. Il est appelé lorsque le serveur
// répond 401, c'est-à-dire quand le jeton a expiré ou n'est plus valable. Le jeton
// ayant une durée de vie de deux heures, ce cas se produit réellement en usage.
let surSessionPerdue = null;

export function definirRappelSessionPerdue(rappel) {
  surSessionPerdue = rappel;
}

export class ErreurApi extends Error {
  constructor(message, statut, champs) {
    super(message);
    this.name = 'ErreurApi';
    this.statut = statut;
    // Erreurs de validation, champ par champ, telles que le serveur les renvoie.
    this.champs = champs ?? null;
  }
}

async function lireCorps(reponse) {
  // Un 204 n'a pas de corps, et une erreur d'infrastructure peut ne pas être du JSON.
  if (reponse.status === 204) {
    return null;
  }
  try {
    return await reponse.json();
  } catch {
    return null;
  }
}

export async function requete(chemin, { methode = 'GET', corps, jeton } = {}) {
  const entetes = {};

  if (corps !== undefined) {
    entetes['Content-Type'] = 'application/json';
  }
  if (jeton) {
    entetes.Authorization = `Bearer ${jeton}`;
  }

  let reponse;
  try {
    reponse = await fetch(`${BASE}${chemin}`, {
      method: methode,
      headers: entetes,
      body: corps !== undefined ? JSON.stringify(corps) : undefined,
    });
  } catch {
    // Coupure réseau ou serveur injoignable : l'appelant reçoit un message lisible
    // plutôt qu'une exception technique.
    throw new ErreurApi('Le serveur est injoignable. Vérifiez votre connexion.', 0);
  }

  const donnees = await lireCorps(reponse);

  if (reponse.ok) {
    return donnees;
  }

  if (reponse.status === 401) {
    // La session n'est plus valable : le contexte vide le jeton, la garde de routes
    // renvoie alors vers la connexion.
    surSessionPerdue?.();
  }

  // Le serveur normalise déjà ses erreurs : on expose son message plutôt qu'un objet
  // brut, sans jamais le reformuler. Un message d'échec de connexion volontairement
  // générique doit arriver tel quel à l'utilisateur.
  throw new ErreurApi(
    donnees?.erreur ?? 'Une erreur est survenue.',
    reponse.status,
    donnees?.champs
  );
}

export const api = {
  inscription: (donnees) => requete('/auth/inscription', { methode: 'POST', corps: donnees }),
  connexion: (donnees) => requete('/auth/connexion', { methode: 'POST', corps: donnees }),
  profil: (jeton) => requete('/auth/moi', { jeton }),
  portefeuille: (jeton) => requete('/portefeuille', { jeton }),
  // La fenêtre borne les points de la courbe ; les performances par plage, elles,
  // portent toujours sur l'historique complet et sont calculées par le serveur.
  historique: (jeton, jours) =>
    requete(jours ? `/portefeuille/historique?jours=${jours}` : '/portefeuille/historique', {
      jeton,
    }),
  // Détail d'une position : état courant, mouvements enrichis de leur effet sur le prix
  // de revient, et historique de cours avec la performance de chaque plage. Une
  // ressource appartenant à un autre compte répond 404, jamais 403 (D52) : l'appelant
  // ne peut pas distinguer l'inexistant de ce qui ne lui appartient pas.
  actif: (jeton, id) => requete(`/actifs/${id}`, { jeton }),
  supprimerActif: (jeton, id) => requete(`/actifs/${id}`, { methode: 'DELETE', jeton }),
  supprimerTransaction: (jeton, actifId, transactionId) =>
    requete(`/actifs/${actifId}/transactions/${transactionId}`, { methode: 'DELETE', jeton }),
  alertes: (jeton) => requete('/alertes', { jeton }),
};
