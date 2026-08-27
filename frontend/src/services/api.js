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

// Le nom du fichier est porté par l'en-tête Content-Disposition. Il est produit par le
// serveur à partir d'une date, jamais d'une saisie : il n'y a rien à assainir ici, mais
// un repli reste prévu si l'en-tête venait à ne pas être lisible.
function nomDeFichier(reponse, repli) {
  const entete = reponse.headers.get('Content-Disposition') ?? '';
  const trouve = entete.match(/filename="([^"]+)"/);
  return trouve ? trouve[1] : repli;
}

// Récupération d'un fichier, là où requete() attend du JSON. Les deux partagent l'en-tête
// d'autorisation, le traitement de la session perdue et la forme des erreurs ; seule la
// lecture du corps diffère.
//
// Un simple lien vers l'adresse ne conviendrait pas : le jeton vit en mémoire (D57) et
// n'accompagne pas une navigation du navigateur. Le fichier est donc demandé comme
// n'importe quel appel authentifié, puis remis à l'utilisateur depuis la page.
export async function requeteFichier(chemin, { jeton, nomParDefaut = 'export.csv' } = {}) {
  let reponse;
  try {
    reponse = await fetch(`${BASE}${chemin}`, {
      headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
    });
  } catch {
    throw new ErreurApi('Le serveur est injoignable. Vérifiez votre connexion.', 0);
  }

  if (!reponse.ok) {
    if (reponse.status === 401) {
      surSessionPerdue?.();
    }
    // Un échec renvoie du JSON, même sur une route qui rend un fichier en cas de succès.
    let donnees = null;
    try {
      donnees = await reponse.json();
    } catch {
      donnees = null;
    }
    throw new ErreurApi(donnees?.erreur ?? 'Une erreur est survenue.', reponse.status);
  }

  return { blob: await reponse.blob(), nomFichier: nomDeFichier(reponse, nomParDefaut) };
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
  creerActif: (jeton, donnees) => requete('/actifs', { methode: 'POST', corps: donnees, jeton }),
  supprimerActif: (jeton, id) => requete(`/actifs/${id}`, { methode: 'DELETE', jeton }),
  creerTransaction: (jeton, actifId, donnees) =>
    requete(`/actifs/${actifId}/transactions`, { methode: 'POST', corps: donnees, jeton }),
  // Effet d'un mouvement avant son enregistrement : nouveau prix de revient, quantité
  // détenue après, plus-value dégagée par une vente. Rien n'est écrit. Ces valeurs sont
  // des états métier et viennent donc du moteur du serveur, jamais d'un calcul refait
  // ici (D69).
  simulerTransaction: (jeton, actifId, donnees) =>
    requete(`/actifs/${actifId}/transactions/simulation`, {
      methode: 'POST',
      corps: donnees,
      jeton,
    }),
  supprimerTransaction: (jeton, actifId, transactionId) =>
    requete(`/actifs/${actifId}/transactions/${transactionId}`, { methode: 'DELETE', jeton }),
  // Chaque alerte revient enrichie de la valeur actuellement observée sur sa cible et
  // de l'écart restant avant franchissement, en pourcentage : deux valeurs dérivées
  // d'un montant, calculées par le serveur et non recalculées ici (D69).
  alertes: (jeton) => requete('/alertes', { jeton }),
  creerAlerte: (jeton, donnees) => requete('/alertes', { methode: 'POST', corps: donnees, jeton }),
  // Seule la désactivation est exposée par le contrat : c'est la seule mutation de
  // statut qu'accepte le schéma de validation du serveur.
  desactiverAlerte: (jeton, id) =>
    requete(`/alertes/${id}`, { methode: 'PATCH', corps: { statut: 'desactivee' }, jeton }),
  // Le compte agit toujours sur le porteur du jeton : aucune de ces trois routes ne
  // reçoit d'identifiant d'utilisateur, il n'y en a donc aucun à transmettre.
  changerMotDePasse: (jeton, donnees) =>
    requete('/compte/mot-de-passe', { methode: 'PATCH', corps: donnees, jeton }),
  // Le mot de passe accompagne la suppression : c'est le serveur qui le vérifie, la
  // confirmation devant résister à un appel direct et pas seulement au dialogue.
  supprimerCompte: (jeton, donnees) => requete('/compte', { methode: 'DELETE', corps: donnees, jeton }),
  exporterMouvements: (jeton) =>
    requeteFichier('/compte/export-mouvements', { jeton, nomParDefaut: 'capitall-mouvements.csv' }),
};
