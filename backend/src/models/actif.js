// Accès aux données de la table actif. Toutes les requêtes sont paramétrées et portent
// leur propre filtre sur le propriétaire : le cloisonnement est garanti par le SQL
// lui-même (D7), jamais par une comparaison faite après coup en JavaScript. Une requête
// qui ne trouve rien parce que l'actif appartient à quelqu'un d'autre est indiscernable,
// pour l'appelant, d'une requête sur un actif inexistant.

const { query } = require('../db');
const { ErreurConflit } = require('../erreurs');

const CHAMPS = 'id, utilisateur_id, type, symbole, nom, date_ajout';

// Violation de la contrainte UNIQUE (utilisateur_id, symbole).
const CODE_VIOLATION_UNICITE = '23505';

async function listerParUtilisateur(utilisateurId) {
  const { rows } = await query(
    `SELECT ${CHAMPS}
     FROM actif
     WHERE utilisateur_id = $1
     ORDER BY type, symbole`,
    [utilisateurId]
  );
  return rows;
}

async function trouverParIdEtUtilisateur(id, utilisateurId) {
  const { rows } = await query(
    `SELECT ${CHAMPS}
     FROM actif
     WHERE id = $1 AND utilisateur_id = $2`,
    [id, utilisateurId]
  );
  return rows[0] || null;
}

async function creer({ utilisateurId, type, symbole, nom }) {
  try {
    const { rows } = await query(
      `INSERT INTO actif (utilisateur_id, type, symbole, nom)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CHAMPS}`,
      [utilisateurId, type, symbole, nom]
    );
    return rows[0];
  } catch (erreur) {
    if (erreur.code === CODE_VIOLATION_UNICITE) {
      throw new ErreurConflit(`Le symbole ${symbole} est déjà suivi.`);
    }
    throw erreur;
  }
}

async function mettreAJourNom(id, utilisateurId, nom) {
  const { rows } = await query(
    `UPDATE actif
     SET nom = $3
     WHERE id = $1 AND utilisateur_id = $2
     RETURNING ${CHAMPS}`,
    [id, utilisateurId, nom]
  );
  return rows[0] || null;
}

// La suppression entraîne en cascade celle des transactions de l'actif et des alertes
// qui le ciblent (contraintes ON DELETE CASCADE du schéma).
async function supprimer(id, utilisateurId) {
  const { rowCount } = await query('DELETE FROM actif WHERE id = $1 AND utilisateur_id = $2', [
    id,
    utilisateurId,
  ]);
  return rowCount > 0;
}

module.exports = {
  listerParUtilisateur,
  trouverParIdEtUtilisateur,
  creer,
  mettreAJourNom,
  supprimer,
};
