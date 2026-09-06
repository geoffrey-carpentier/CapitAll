-- Script de création de la base CapitAll
-- MLD décrit dans docs/conception/modele-de-donnees.md
-- A exécuter sur une base PostgreSQL vide (psql -f schema.sql, ou via le service db du docker-compose)

-- Nettoyage pour ré-exécution en environnement de développement
DROP TABLE IF EXISTS annonce CASCADE;
DROP TABLE IF EXISTS reinitialisation_mot_de_passe CASCADE;
DROP TABLE IF EXISTS snapshot_cours CASCADE;
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
    -- Borne de révocation : tout jeton émis avant cet instant est refusé, quelle que
    -- soit sa date d'expiration. Une borne plutôt qu'une liste de jetons révoqués — un
    -- jeton porte sa date d'émission, il suffit de la comparer, et il n'y a alors rien
    -- à écrire à chaque déconnexion ni à purger ensuite.
    jetons_invalides_avant TIMESTAMPTZ,
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
    -- Trois natures de mouvement, portées par une seule colonne. Une sortie non
    -- marchande est un retrait ou un transfert : la quantité quitte la position sans
    -- produit en euros. Une seconde colonne « nature » à côté du sens permettrait des
    -- combinaisons contradictoires qu'il faudrait ensuite interdire par contrainte.
    sens              VARCHAR(25) NOT NULL CHECK (sens IN ('achat', 'vente', 'sortie_non_marchande')),
    quantite          NUMERIC(38, 18) NOT NULL CHECK (quantite > 0),
    prix_unitaire     NUMERIC(38, 18) NOT NULL CHECK (prix_unitaire >= 0),
    -- Contre-valeur des frais en euros au moment de l'opération : c'est elle que le
    -- moteur consomme, et elle seule.
    frais             NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (frais >= 0),
    -- Montant et unité réellement prélevés. Une plateforme qui retient 0,002 ETH ne
    -- prélève pas des euros : convertir à la saisie et n'en garder que le résultat
    -- perdrait le fait, sans moyen de le reconstituer.
    frais_montant     NUMERIC(38, 18) NOT NULL DEFAULT 0 CHECK (frais_montant >= 0),
    frais_unite       VARCHAR(20) NOT NULL DEFAULT 'EUR',
    date_transaction  TIMESTAMPTZ NOT NULL,
    note              TEXT,
    -- En euros, le montant prélevé et sa contre-valeur sont le même nombre. La
    -- contrainte l'impose plutôt que de laisser deux colonnes diverger en silence, et
    -- elle rend les lignes antérieures exactes sans conversion.
    CONSTRAINT transaction_frais_euros_coherents
        CHECK (frais_unite <> 'EUR' OR frais_montant = frais),
    -- Une sortie non marchande ne dégage aucun produit : le prix y serait une valeur
    -- inventée, et c'est elle qui ferait apparaître un transfert comme une vente.
    CONSTRAINT transaction_sortie_sans_prix
        CHECK (sens <> 'sortie_non_marchande' OR prix_unitaire = 0)
);

CREATE TABLE alerte (
    id                  SERIAL PRIMARY KEY,
    utilisateur_id      INTEGER NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    actif_id            INTEGER REFERENCES actif(id) ON DELETE CASCADE,
    type_cible          VARCHAR(20) NOT NULL CHECK (type_cible IN ('actif', 'capital_total')),
    sens_seuil          VARCHAR(20) NOT NULL CHECK (sens_seuil IN ('au_dessus', 'en_dessous')),
    valeur_seuil        NUMERIC(38, 18) NOT NULL CHECK (valeur_seuil > 0),
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
    valeur_totale_eur   NUMERIC(30, 2) NOT NULL CHECK (valeur_totale_eur >= 0),
    -- Instant exact du relevé. Le point du jour est écrit à la première actualisation de
    -- la journée : son heure dépend donc de l'utilisateur, et l'interface l'annonce
    -- plutôt que de laisser croire à un relevé de clôture. Nullable : les points
    -- antérieurs à cette colonne ont été relevés à une heure que rien n'a conservée.
    heure_releve        TIMESTAMPTZ,
    UNIQUE (utilisateur_id, date_snapshot)
);

-- Historique du cours de chaque position, jour par jour.
--
-- Même dérogation assumée que snapshot_valorisation : un cours passé ne se recalcule
-- pas, les fournisseurs ne conservant pas leur historique de la même façon selon la
-- classe d'actif. C'est un fait daté, pas une valeur dérivée.
--
-- Aucun utilisateur_id ici : le propriétaire se lit par jointure sur actif, comme pour
-- transaction. Le dupliquer créerait une seconde vérité sur le cloisonnement.
CREATE TABLE snapshot_cours (
    id             SERIAL PRIMARY KEY,
    actif_id       INTEGER NOT NULL REFERENCES actif(id) ON DELETE CASCADE,
    date_snapshot  DATE NOT NULL,
    cours_eur      NUMERIC(38, 18) NOT NULL CHECK (cours_eur >= 0),
    -- Quantité détenue ce jour-là : elle rend l'historique lisible sans avoir à rejouer
    -- les transactions antérieures à chaque point de la courbe.
    quantite       NUMERIC(38, 18) NOT NULL CHECK (quantite >= 0),
    -- Même instant, même raison que sur snapshot_valorisation : les deux séries sont
    -- écrites par le même déclencheur, elles doivent dire la même chose de leur pas.
    heure_releve   TIMESTAMPTZ,
    UNIQUE (actif_id, date_snapshot)
);

-- Demandes de réinitialisation de mot de passe en cours (D23 : l'administrateur ne
-- réinitialise pas le mot de passe d'un tiers, l'utilisateur doit pouvoir le faire seul).
--
-- Le jeton remis à l'utilisateur n'est pas conservé : seule son empreinte l'est. Une
-- base lue par un tiers ne donne alors aucun moyen de prendre la main sur un compte.
-- SHA-256 et non bcrypt : le jeton fait trente-deux octets tirés au hasard, il n'est pas
-- devinable par force brute, et le coût de bcrypt n'aurait ici aucun objet — il protège
-- les secrets à faible entropie, ce qu'un mot de passe est et qu'un jeton ne l'est pas.
CREATE TABLE reinitialisation_mot_de_passe (
    id              SERIAL PRIMARY KEY,
    utilisateur_id  INTEGER NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    jeton_hache     CHAR(64) NOT NULL UNIQUE,
    date_creation   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expire_le       TIMESTAMPTZ NOT NULL,
    -- Renseignée au moment où la demande sert : une demande ne sert qu'une fois.
    utilise_le      TIMESTAMPTZ
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
CREATE INDEX idx_reinitialisation_utilisateur ON reinitialisation_mot_de_passe(utilisateur_id);

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

-- Le nom de la base n'est pas écrit en dur : GRANT n'accepte pas de paramètre, mais
-- current_database() rend le nom réel et format(%I) l'échappe comme identifiant. Le
-- script s'applique ainsi à la base sur laquelle on l'exécute, quelle qu'elle soit.
-- Écrit en dur, il imposait de modifier ce fichier pour toute base portant un autre
-- nom, contrainte que docker-compose.production.yml devait signaler en commentaire.
DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO capitall_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO capitall_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO capitall_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO capitall_app;
