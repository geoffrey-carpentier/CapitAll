// Accès à la table snapshot_cours : l'historique du cours de chaque position.
//
// Même dérogation assumée que pour snapshot_valorisation (D8, D16, D81) : un cours
// passé ne se recalcule pas. Les fournisseurs ne conservent pas leur historique de la
// même façon selon la classe d'actif, et l'un d'eux n'en expose aucun. Ce que
// l'application n'a pas relevé le jour même est définitivement perdu, ce qui fait de
// chaque ligne un fait daté et non une valeur redondante.
//
// Aucune requête de ce module ne prend un identifiant d'utilisateur pour le comparer
// après coup : le propriétaire entre dans le SQL, par jointure sur actif, exactement
// comme pour les transactions. Une lecture portant sur l'actif d'un autre compte ne
// rend rien, et rien n'est indiscernable d'un actif inexistant (D52).

const { query } = require('../db');

// Écriture des cours du jour pour toutes les positions à la fois.
//
// Une seule instruction plutôt qu'une par position : le tableau de bord charge six
// actifs chez un utilisateur ordinaire, et autant d'allers-retours pour un effet de
// bord d'historisation coûterait plus cher que le calcul lui-même.
//
// ON CONFLICT DO NOTHING s'appuie sur l'unicité (actif_id, date_snapshot). Deux onglets
// ouverts en même temps passeraient tous deux un contrôle d'existence préalable ; ici,
// c'est la base qui arbitre, comme pour la valorisation totale.
async function enregistrerSiAbsent(utilisateurId, positions) {
  const aHistoriser = positions.filter(
    (position) => position.cours_eur !== null && position.cours_eur !== undefined
  );

  if (aHistoriser.length === 0) {
    return [];
  }

  const { rows } = await query(
    `INSERT INTO snapshot_cours (actif_id, date_snapshot, cours_eur, quantite)
     SELECT a.id, CURRENT_DATE, entree.cours_eur, entree.quantite
     FROM unnest($2::integer[], $3::numeric[], $4::numeric[])
          AS entree(actif_id, cours_eur, quantite)
     JOIN actif a ON a.id = entree.actif_id AND a.utilisateur_id = $1
     ON CONFLICT (actif_id, date_snapshot) DO NOTHING
     RETURNING actif_id`,
    [
      utilisateurId,
      aHistoriser.map((position) => position.id),
      aHistoriser.map((position) => position.cours_eur),
      aHistoriser.map((position) => position.quantite_detenue ?? '0'),
    ]
  );

  // Aucune ligne rendue signifie que l'historique du jour existait déjà : c'est le cas
  // courant dès la seconde consultation, pas une erreur.
  return rows;
}

// Historique d'une position, du plus ancien au plus récent, prêt à être tracé.
//
// La date est formatée en chaîne par PostgreSQL plutôt que rendue comme colonne DATE :
// le pilote la convertirait sinon en instant interprété dans le fuseau du serveur, et
// la sérialisation JSON afficherait la veille à l'est de Greenwich. Une date de
// snapshot est un jour calendaire, pas un instant.
async function listerParActif(actifId, utilisateurId, nombreDeJours) {
  const conditionDeDate = nombreDeJours ? 'AND sc.date_snapshot >= CURRENT_DATE - $3::integer' : '';
  const parametres = nombreDeJours ? [actifId, utilisateurId, nombreDeJours] : [actifId, utilisateurId];

  const { rows } = await query(
    `SELECT to_char(sc.date_snapshot, 'YYYY-MM-DD') AS date_snapshot,
            sc.cours_eur,
            sc.quantite
     FROM snapshot_cours sc
     JOIN actif a ON a.id = sc.actif_id
     WHERE sc.actif_id = $1 AND a.utilisateur_id = $2 ${conditionDeDate}
     ORDER BY sc.date_snapshot`,
    parametres
  );
  return rows;
}

// Historique récent de toutes les positions d'un utilisateur, en une seule requête.
//
// C'est ce qui alimente la colonne de tendance du tableau des positions. Interroger
// chaque actif séparément multiplierait les allers-retours par le nombre de lignes du
// tableau, pour une information secondaire.
async function listerRecentsParUtilisateur(utilisateurId, nombreDeJours) {
  const { rows } = await query(
    `SELECT sc.actif_id,
            to_char(sc.date_snapshot, 'YYYY-MM-DD') AS date_snapshot,
            sc.cours_eur
     FROM snapshot_cours sc
     JOIN actif a ON a.id = sc.actif_id
     WHERE a.utilisateur_id = $1
       AND sc.date_snapshot >= CURRENT_DATE - $2::integer
     ORDER BY sc.actif_id, sc.date_snapshot`,
    [utilisateurId, nombreDeJours]
  );
  return rows;
}

module.exports = { enregistrerSiAbsent, listerParActif, listerRecentsParUtilisateur };
