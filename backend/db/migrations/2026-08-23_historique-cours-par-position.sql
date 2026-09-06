-- Migration : historique de cours par position
-- Date : 23/08/2026
--
-- Le modèle ne conservait qu'une seule série temporelle, la valeur totale du
-- portefeuille dans snapshot_valorisation. Aucune série par position n'existait, alors
-- que l'interface en a besoin en deux endroits : le graphe de cours avec ligne de prix
-- de revient de l'écran de détail, et la colonne de tendance sur trente jours du
-- tableau des positions.
--
-- Comme snapshot_valorisation, cette table déroge sciemment à la règle « aucune valeur
-- dérivée n'est stockée » : le cours du bitcoin au 12 mars ne se recalcule pas après
-- coup, les fournisseurs ne conservant pas leur historique gratuitement et de la même
-- façon selon la classe d'actif. C'est un fait daté, pas une redondance.
--
-- Le cloisonnement reste porté par le SQL, par jointure sur actif, exactement comme
-- pour transaction. Dénormaliser utilisateur_id ici créerait une seconde vérité sur le
-- propriétaire d'une ligne, avec la certitude qu'elles divergent un jour.
--
-- À exécuter sur une base existante, avec un rôle propriétaire :
--   psql -d capitall -f backend/db/migrations/2026-08-23_historique-cours-par-position.sql
--
-- Les bases créées après cette date à partir de schema.sql comportent déjà la table :
-- IF NOT EXISTS rend cette migration sans effet dans ce cas, et rejouable sans risque.

CREATE TABLE IF NOT EXISTS snapshot_cours (
    id             SERIAL PRIMARY KEY,
    actif_id       INTEGER NOT NULL REFERENCES actif(id) ON DELETE CASCADE,
    date_snapshot  DATE NOT NULL,
    cours_eur      NUMERIC(18, 2) NOT NULL CHECK (cours_eur >= 0),
    -- Quantité détenue ce jour-là. Elle rend l'historique lisible seul : sans elle,
    -- reconstituer la valeur passée d'une position obligerait à rejouer toutes les
    -- transactions antérieures à chaque point de la courbe.
    quantite       NUMERIC(24, 8) NOT NULL CHECK (quantite >= 0),
    UNIQUE (actif_id, date_snapshot)
);

-- Aucun index supplémentaire n'est créé : la contrainte d'unicité en produit déjà un
-- sur (actif_id, date_snapshot), dans cet ordre, et c'est exactement la lecture faite
-- par l'application, un actif filtré puis trié par date.

COMMENT ON TABLE snapshot_cours IS
    'Cours unitaire et quantité détenue, par position et par jour. Le propriétaire se lit par jointure sur actif.';

-- Le rôle applicatif est créé avec ses droits par schema.sql, avant l'existence de
-- cette table : sur une base déjà en service, la table nouvelle ne les hérite pas.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'capitall_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON snapshot_cours TO capitall_app;
        GRANT USAGE, SELECT ON SEQUENCE snapshot_cours_id_seq TO capitall_app;
    END IF;
END
$$;
