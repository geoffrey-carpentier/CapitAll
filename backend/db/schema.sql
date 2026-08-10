-- Script de création de la base CapitAll
-- MLD décrit dans docs/conception/modele-de-donnees.md
-- A exécuter sur une base PostgreSQL vide (psql -f schema.sql, ou via le service db du docker-compose)

-- Nettoyage pour ré-exécution en environnement de développement
DROP TABLE IF EXISTS annonce CASCADE;
DROP TABLE IF EXISTS snapshot_valorisation CASCADE;
DROP TABLE IF EXISTS alerte CASCADE;
DROP TABLE IF EXISTS transaction CASCADE;
DROP TABLE IF EXISTS actif CASCADE;
DROP TABLE IF EXISTS utilisateur CASCADE;

CREATE TABLE utilisateur (
    id                  SERIAL PRIMARY KEY,
    email               VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe_hache  VARCHAR(255) NOT NULL,
    pseudo              VARCHAR(100) NOT NULL,
    role                VARCHAR(20) NOT NULL DEFAULT 'utilisateur' CHECK (role IN ('utilisateur', 'admin')),
    -- Désactivation logique d'un compte : la connexion est refusée, mais aucune donnée
    -- n'est supprimée et l'opération reste réversible. Un compte est actif à la création.
    actif               BOOLEAN NOT NULL DEFAULT true,
    date_inscription    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE actif (
    id              SERIAL PRIMARY KEY,
    utilisateur_id  INTEGER NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('crypto', 'devise', 'metal', 'action')),
    symbole         VARCHAR(20) NOT NULL,
    nom             VARCHAR(100) NOT NULL,
    date_ajout      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (utilisateur_id, symbole)
);

CREATE TABLE transaction (
    id                SERIAL PRIMARY KEY,
    actif_id          INTEGER NOT NULL REFERENCES actif(id) ON DELETE CASCADE,
    sens              VARCHAR(10) NOT NULL CHECK (sens IN ('achat', 'vente')),
    quantite          NUMERIC(24, 8) NOT NULL CHECK (quantite > 0),
    prix_unitaire     NUMERIC(18, 2) NOT NULL CHECK (prix_unitaire >= 0),
    frais             NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (frais >= 0),
    date_transaction  TIMESTAMPTZ NOT NULL,
    note              TEXT
);

CREATE TABLE alerte (
    id                  SERIAL PRIMARY KEY,
    utilisateur_id      INTEGER NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    actif_id            INTEGER REFERENCES actif(id) ON DELETE CASCADE,
    type_cible          VARCHAR(20) NOT NULL CHECK (type_cible IN ('actif', 'capital_total')),
    sens_seuil          VARCHAR(20) NOT NULL CHECK (sens_seuil IN ('au_dessus', 'en_dessous')),
    valeur_seuil        NUMERIC(18, 2) NOT NULL CHECK (valeur_seuil > 0),
    statut              VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'declenchee', 'desactivee')),
    date_creation       TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_declenchement  TIMESTAMPTZ,
    CHECK (
        (type_cible = 'actif' AND actif_id IS NOT NULL) OR
        (type_cible = 'capital_total' AND actif_id IS NULL)
    )
);

CREATE TABLE snapshot_valorisation (
    id                  SERIAL PRIMARY KEY,
    utilisateur_id      INTEGER NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    date_snapshot       DATE NOT NULL,
    valeur_totale_eur   NUMERIC(18, 2) NOT NULL CHECK (valeur_totale_eur >= 0),
    UNIQUE (utilisateur_id, date_snapshot)
);

CREATE TABLE annonce (
    id                  SERIAL PRIMARY KEY,
    auteur_id           INTEGER NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    titre               VARCHAR(200) NOT NULL,
    contenu             TEXT NOT NULL,
    epinglee            BOOLEAN NOT NULL DEFAULT false,
    date_publication    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index de performance sur les clés étrangères et les colonnes de tri fréquentes
CREATE INDEX idx_actif_utilisateur ON actif(utilisateur_id);
CREATE INDEX idx_transaction_actif ON transaction(actif_id);
CREATE INDEX idx_transaction_date ON transaction(date_transaction);
CREATE INDEX idx_alerte_utilisateur ON alerte(utilisateur_id);
CREATE INDEX idx_alerte_actif ON alerte(actif_id) WHERE actif_id IS NOT NULL;
CREATE INDEX idx_annonce_date ON annonce(date_publication DESC);

-- Utilisateur applicatif à droits restreints ("les utilisateurs sont créés
-- avec leurs droits respectifs"). L'application ne se connecte jamais avec le superuser.
-- Le mot de passe réel est fourni via variable d'environnement au moment du déploiement,
-- celui-ci n'est qu'un exemple pour l'environnement de développement local.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'capitall_app') THEN
        CREATE ROLE capitall_app LOGIN PASSWORD 'a_remplacer_en_local';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE capitall TO capitall_app;
GRANT USAGE ON SCHEMA public TO capitall_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO capitall_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO capitall_app;
