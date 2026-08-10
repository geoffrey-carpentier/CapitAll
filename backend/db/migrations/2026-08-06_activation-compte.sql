-- Migration : activation des comptes utilisateurs
-- Date : 06/08/2026
--
-- Ajoute la colonne permettant de désactiver un compte sans supprimer de données.
-- Un compte désactivé ne peut plus se connecter ; l'opération est réversible.
--
-- Le modèle ne comportait aucun moyen de représenter cette désactivation, alors que
-- le rôle d'administration prévoit de la déclencher. La désactivation logique a été
-- préférée à une suppression : elle conserve l'historique des transactions, dont
-- dépendent tous les calculs de prix de revient.
--
-- À exécuter sur une base existante, avec un rôle propriétaire :
--   psql -d capitall -f backend/db/migrations/2026-08-06_activation-compte.sql
--
-- Les bases créées après cette date à partir de schema.sql comportent déjà la colonne :
-- IF NOT EXISTS rend cette migration sans effet dans ce cas, et rejouable sans risque.

ALTER TABLE utilisateur
    ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN utilisateur.actif IS
    'Faux si le compte est désactivé : la connexion est alors refusée, sans suppression de données.';
