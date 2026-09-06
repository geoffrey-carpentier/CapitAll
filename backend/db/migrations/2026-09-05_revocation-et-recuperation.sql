-- Migration : révocation des jetons et récupération de mot de passe (D60 complétée, D23)
-- Date : 05/09/2026
--
-- DEUX MANQUES, LE MÊME SUJET. D60 a créé la colonne d'activation d'un compte, et la
-- connexion la respecte. Mais un jeton déjà émis continuait de fonctionner : désactiver
-- un compte n'interrompait rien tant que le jeton courant n'expirait pas, soit jusqu'à
-- deux heures. La désactivation était donc annoncée sans être appliquée.
--
-- La colonne ajoutée ici est une borne dans le temps, pas une liste de jetons. Un jeton
-- porte sa date d'émission ; il suffit de refuser ceux émis avant la borne. Une table de
-- jetons révoqués aurait imposé d'y écrire à chaque déconnexion et de la purger, pour la
-- même garantie.
--
-- RÉCUPÉRATION DE MOT DE PASSE. D23 conserve à l'administrateur un privilège minimal et
-- lui interdit de réinitialiser le mot de passe d'un tiers : l'utilisateur doit pouvoir
-- le faire seul. La table ci-dessous porte les demandes en cours.
--
-- Le jeton n'est pas stocké : seule son empreinte l'est. Une base lue par un tiers ne
-- donne alors aucun moyen de prendre la main sur un compte. SHA-256 et non bcrypt : le
-- jeton fait trente-deux octets tirés au hasard, il n'est pas devinable par force brute,
-- et le coût de bcrypt n'aurait ici aucun objet — il protège les secrets à faible
-- entropie, ce qu'un mot de passe est et qu'un jeton aléatoire n'est pas.
--
-- PAS DE RETOUR ARRIÈRE. Retirer la borne de révocation rendrait leur validité à des
-- jetons délibérément invalidés.
--
-- À exécuter sur une base existante, avec un rôle propriétaire :
--   psql -d <base> -f backend/db/migrations/2026-09-05_revocation-et-recuperation.sql
-- ou, avec le registre :
--   node backend/db/migrer.js

ALTER TABLE utilisateur
    ADD COLUMN IF NOT EXISTS jetons_invalides_avant TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS reinitialisation_mot_de_passe (
    id              SERIAL PRIMARY KEY,
    utilisateur_id  INTEGER NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    -- Empreinte SHA-256 du jeton remis à l'utilisateur, en hexadécimal.
    jeton_hache     CHAR(64) NOT NULL UNIQUE,
    date_creation   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expire_le       TIMESTAMPTZ NOT NULL,
    -- Renseignée au moment où la demande sert : une demande ne sert qu'une fois.
    utilise_le      TIMESTAMPTZ
);

-- Les demandes d'un compte sont lues ensemble pour être invalidées à l'émission d'une
-- nouvelle : l'index sert cette lecture, l'unicité de l'empreinte servant l'autre.
CREATE INDEX IF NOT EXISTS idx_reinitialisation_utilisateur
    ON reinitialisation_mot_de_passe (utilisateur_id);

-- Le rôle applicatif est créé par schema.sql, avant l'existence de cette table : sur une
-- base déjà en service, la table nouvelle n'hérite pas de ses droits.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'capitall_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON reinitialisation_mot_de_passe TO capitall_app;
        GRANT USAGE, SELECT ON SEQUENCE reinitialisation_mot_de_passe_id_seq TO capitall_app;
    END IF;
END
$$;

-- Contrôle de sortie, même exigence que les deux migrations précédentes : une migration
-- ne peut pas se déclarer appliquée sans l'être.
DO $$
DECLARE
    manquant text := '';
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'utilisateur'
          AND column_name = 'jetons_invalides_avant'
    ) THEN
        manquant := manquant || 'colonne jetons_invalides_avant, ';
    END IF;

    IF to_regclass('public.reinitialisation_mot_de_passe') IS NULL THEN
        manquant := manquant || 'table reinitialisation_mot_de_passe, ';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_reinitialisation_utilisateur'
    ) THEN
        manquant := manquant || 'index sur utilisateur_id, ';
    END IF;

    IF manquant <> '' THEN
        RAISE EXCEPTION 'Migration incomplete : %', rtrim(manquant, ', ');
    END IF;
END
$$;

COMMENT ON COLUMN utilisateur.jetons_invalides_avant IS
    'Tout jeton émis avant cet instant est refusé. Posée au changement de mot de passe et à la désactivation du compte.';

COMMENT ON TABLE reinitialisation_mot_de_passe IS
    'Demandes de réinitialisation en cours. Seule l''empreinte du jeton est conservée ; une demande ne sert qu''une fois.';
