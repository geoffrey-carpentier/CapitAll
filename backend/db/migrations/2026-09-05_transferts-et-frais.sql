-- Migration : frais dans leur unité d'origine, et sorties non marchandes (D89)
-- Date : 05/09/2026
--
-- Deux manques du modèle, qui se règlent au même endroit parce qu'ils partagent la même
-- colonne et la même branche du moteur.
--
-- LES FRAIS. La colonne frais est en euros, et c'est un contrat documenté. Mais une
-- plateforme de cryptomonnaies ne prélève pas des euros : elle retient une fraction de
-- l'actif échangé. Convertir à la saisie et ne garder que le résultat rendait le calcul
-- exact et le fait indisponible : rien ne permettait ensuite de dire combien avait été
-- réellement prélevé, ni en quoi. Deux colonnes s'ajoutent donc à la contre-valeur, sans
-- la remplacer : le montant et l'unité effectivement retenus.
--
-- LES SORTIES NON MARCHANDES. Un retrait vers un portefeuille personnel ne pouvait
-- s'enregistrer que comme une vente à zéro euro. Le montant obtenu était juste, mais
-- l'étiquette était fausse : la frise affichait une vente, et la plus-value réalisée est
-- définie comme constatée lors d'une vente. Le sens gagne donc une troisième valeur.
--
-- DONNÉES EXISTANTES. Aucune conversion, aucune interprétation rétroactive. Les valeurs
-- par défaut posent frais_unite = 'EUR' et frais_montant = frais : les lignes déjà
-- enregistrées restent exactement ce qu'elles étaient, et la contrainte de cohérence les
-- accepte sans retouche. L'unité d'origine d'un frais ancien n'est pas devinée.
--
-- PAS DE RETOUR ARRIÈRE. Retirer frais_unite après usage effacerait l'unité réellement
-- prélevée, que la contre-valeur en euros ne reconstitue pas. Rétrécir le sens à deux
-- valeurs supposerait de requalifier les sorties en ventes, c'est-à-dire de fabriquer les
-- plus-values que cette migration existe pour éviter.
--
-- À exécuter sur une base existante, avec un rôle propriétaire :
--   psql -d <base> -f backend/db/migrations/2026-09-05_transferts-et-frais.sql
-- ou, avec le registre :
--   node backend/db/migrer.js
--
-- Les bases créées après cette date à partir de schema.sql portent déjà ces colonnes :
-- les contrôles d'existence ci-dessous rendent la migration sans effet, et donc
-- rejouable sans risque.

ALTER TABLE transaction
    ADD COLUMN IF NOT EXISTS frais_montant NUMERIC(38, 18) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS frais_unite   VARCHAR(20) NOT NULL DEFAULT 'EUR';

-- Les lignes antérieures à la colonne ont reçu 0 par défaut, et non leur montant de
-- frais : la valeur par défaut ne connaît pas la ligne qu'elle remplit. Le report est
-- fait ici, une seule fois, et seulement là où il n'a pas déjà eu lieu.
UPDATE transaction
   SET frais_montant = frais
 WHERE frais_unite = 'EUR'
   AND frais_montant <> frais;

-- Le sens passe de deux valeurs à trois. La contrainte est reconstruite plutôt
-- qu'ajoutée : deux CHECK sur la même colonne se cumulent, et l'ancien continuerait de
-- refuser la valeur nouvelle.
ALTER TABLE transaction
    ALTER COLUMN sens TYPE VARCHAR(25);

ALTER TABLE transaction
    DROP CONSTRAINT IF EXISTS transaction_sens_check;

ALTER TABLE transaction
    ADD CONSTRAINT transaction_sens_check
        CHECK (sens IN ('achat', 'vente', 'sortie_non_marchande'));

ALTER TABLE transaction
    DROP CONSTRAINT IF EXISTS transaction_frais_montant_check;

ALTER TABLE transaction
    ADD CONSTRAINT transaction_frais_montant_check CHECK (frais_montant >= 0);

ALTER TABLE transaction
    DROP CONSTRAINT IF EXISTS transaction_frais_euros_coherents;

ALTER TABLE transaction
    ADD CONSTRAINT transaction_frais_euros_coherents
        CHECK (frais_unite <> 'EUR' OR frais_montant = frais);

ALTER TABLE transaction
    DROP CONSTRAINT IF EXISTS transaction_sortie_sans_prix;

ALTER TABLE transaction
    ADD CONSTRAINT transaction_sortie_sans_prix
        CHECK (sens <> 'sortie_non_marchande' OR prix_unitaire = 0);

-- Contrôle de sortie.
--
-- Même exigence que la migration de précision : une migration ne peut pas se déclarer
-- appliquée sans l'être. Le bloc relit ce qui est réellement en place — les deux
-- colonnes, les trois contraintes, et l'acceptation effective de la valeur nouvelle par
-- le CHECK reconstruit — et lève si l'un des points manque.
DO $$
DECLARE
    manquant text := '';
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaction'
          AND column_name = 'frais_montant' AND numeric_precision = 38 AND numeric_scale = 18
    ) THEN
        manquant := manquant || 'colonne frais_montant, ';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaction'
          AND column_name = 'frais_unite'
    ) THEN
        manquant := manquant || 'colonne frais_unite, ';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'transaction'::regclass
          AND conname = 'transaction_sens_check'
          AND pg_get_constraintdef(oid) LIKE '%sortie_non_marchande%'
    ) THEN
        manquant := manquant || 'valeur sortie_non_marchande du sens, ';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'transaction'::regclass
          AND conname = 'transaction_frais_euros_coherents'
    ) THEN
        manquant := manquant || 'contrainte de cohérence des frais en euros, ';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'transaction'::regclass
          AND conname = 'transaction_sortie_sans_prix'
    ) THEN
        manquant := manquant || 'contrainte de prix nul sur sortie, ';
    END IF;

    IF EXISTS (
        SELECT 1 FROM transaction WHERE frais_unite = 'EUR' AND frais_montant <> frais
    ) THEN
        manquant := manquant || 'report des frais en euros, ';
    END IF;

    IF manquant <> '' THEN
        RAISE EXCEPTION 'Migration incomplete : %', rtrim(manquant, ', ');
    END IF;
END
$$;

COMMENT ON COLUMN transaction.frais IS
    'Contre-valeur des frais en euros au moment de l''opération. C''est la seule forme que le moteur consomme.';

COMMENT ON COLUMN transaction.frais_montant IS
    'Montant des frais dans l''unité réellement prélevée. Égal à frais lorsque celle-ci est l''euro.';

COMMENT ON COLUMN transaction.frais_unite IS
    'Unité réellement prélevée : EUR, le symbole de l''actif échangé, ou celui d''un tiers actif.';

COMMENT ON COLUMN transaction.sens IS
    'Nature du mouvement. Une sortie non marchande retire de la quantité sans produit en euros : sa valeur est portée par le coût des sorties, jamais par la plus-value réalisée.';
