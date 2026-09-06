-- Migration : précision numérique native (D88)
-- Date : 05/09/2026
--
-- Les prix, les cours et les seuils étaient stockés en NUMERIC(18,2). Mesuré sur
-- PostgreSQL 16, un prix de 0,0000123 euro y est stocké 0,00 : cinq millions d'unités
-- achetées à ce prix rendaient un coût de 0,00 euro au lieu de 61,50. La perte n'est pas
-- toujours vers le bas — 0,005 remonte à 0,01, ce qui double la valeur d'une position.
--
-- Les quantités passent de huit à dix-huit décimales, précision native des actifs
-- suivis : c'est le wei d'Ethereum. Le satoshi du bitcoin en demandait huit, ce qui
-- expliquait le choix précédent ; les jetons ERC-20 en demandent dix-huit.
--
-- snapshot_cours.quantite suit transaction.quantite. Sans cet alignement, la quantité
-- historisée serait tronquée par rapport à celle du mouvement dont elle dérive, et deux
-- lectures du même fait rendraient deux valeurs.
--
-- snapshot_valorisation.valeur_totale_eur gagne des chiffres entiers et non des
-- décimales : c'est un agrégat, sa borne doit dominer celle des produits qu'il totalise.
-- Le changement ne touchant pas l'échelle, il ne réécrit pas la table.
--
-- CE QUI N'EST PAS RÉCUPÉRÉ. Élargir une colonne ne reconstitue pas ce que l'arrondi a
-- supprimé. Une ligne enregistrée à 0,00 le reste : elle vaudra 0,000000000000000000.
-- Les valeurs déjà exactes, elles, traversent intactes, complétées par des zéros.
--
-- PAS DE RETOUR ARRIÈRE. Rétrécir l'échelle après usage tronquerait les valeurs saisies
-- depuis. Une migration inverse ne serait pas une annulation mais une seconde perte : la
-- reprise passe par une restauration de sauvegarde, ou par une correction en avant.
--
-- COMPORTEMENT MESURÉ, sur 200 000 lignes et 14 Mo, PostgreSQL 16 :
--   changement d'échelle    -> réécriture de la table, 233 ms, verrou ACCESS EXCLUSIVE
--   précision seule accrue  -> aucune réécriture, 3,3 ms
-- Un portefeuille personnel comptant quelques milliers de mouvements, la durée attendue
-- est de l'ordre de la milliseconde. Ce sont les données perdues, non le verrou, qui
-- font le risque de cette migration.
--
-- À exécuter sur une base existante, avec un rôle propriétaire :
--   psql -d <base> -f backend/db/migrations/2026-09-05_precision-numerique.sql
-- ou, avec le registre :
--   node backend/db/migrer.js
--
-- Les bases créées après cette date à partir de schema.sql portent déjà ces échelles.
-- Le contrôle d'échelle ci-dessous rend la migration sans effet dans ce cas, et donc
-- rejouable sans risque.

-- Les colonnes visées, et leur échelle cible.
CREATE TEMP TABLE echelles_visees (nom_table text, nom_colonne text, precision_cible int, echelle_cible int);

INSERT INTO echelles_visees VALUES
    ('transaction',           'quantite',          38, 18),
    ('transaction',           'prix_unitaire',     38, 18),
    ('snapshot_cours',        'cours_eur',         38, 18),
    ('snapshot_cours',        'quantite',          38, 18),
    ('alerte',                'valeur_seuil',      38, 18),
    ('snapshot_valorisation', 'valeur_totale_eur', 30,  2);

DO $$
DECLARE
    cible record;
BEGIN
    FOR cible IN SELECT * FROM echelles_visees LOOP
        -- La colonne porte-t-elle déjà l'échelle visée ? Comparer avant d'agir évite de
        -- réécrire une table pour rien sur une base déjà à jour, et rend la migration
        -- rejouable sans risque.
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = cible.nom_table
              AND column_name = cible.nom_colonne
              AND (numeric_precision <> cible.precision_cible
                   OR numeric_scale <> cible.echelle_cible)
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I ALTER COLUMN %I TYPE NUMERIC(%s, %s)',
                cible.nom_table, cible.nom_colonne, cible.precision_cible, cible.echelle_cible
            );
            RAISE NOTICE 'Colonne %.% portee a NUMERIC(%, %)',
                cible.nom_table, cible.nom_colonne, cible.precision_cible, cible.echelle_cible;
        END IF;
    END LOOP;
END
$$;

-- Contrôle de sortie.
--
-- Une première rédaction de cette migration s'annonçait appliquée sans avoir rien
-- changé : elle parcourait un tableau à deux dimensions dont l'indexation rendait NULL,
-- la condition ne trouvait donc jamais de colonne, et aucune erreur n'était levée. Le
-- registre l'enregistrait comme passée, et le schéma restait tel quel.
--
-- Ce bloc ferme ce mode de défaillance : il relit les échelles réellement en place et
-- lève si l'une d'elles n'est pas celle visée. Une migration ne peut plus se déclarer
-- appliquée sans l'être.
DO $$
DECLARE
    manquantes text;
BEGIN
    SELECT string_agg(format('%s.%s', v.nom_table, v.nom_colonne), ', ')
    INTO manquantes
    FROM echelles_visees v
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = v.nom_table
     AND c.column_name = v.nom_colonne
    WHERE c.column_name IS NULL
       OR c.numeric_precision <> v.precision_cible
       OR c.numeric_scale <> v.echelle_cible;

    IF manquantes IS NOT NULL THEN
        RAISE EXCEPTION 'Echelles non appliquees : %', manquantes;
    END IF;
END
$$;

DROP TABLE echelles_visees;

COMMENT ON COLUMN transaction.prix_unitaire IS
    'Prix unitaire en euros, à dix-huit décimales : les actifs cotés sous le centime perdaient toute valeur à deux décimales.';

COMMENT ON COLUMN transaction.quantite IS
    'Quantité détenue, à la précision native des actifs suivis (dix-huit décimales, le wei d''Ethereum).';

COMMENT ON COLUMN snapshot_cours.cours_eur IS
    'Cours relevé en euros, même échelle que le prix unitaire : un cours passé ne se recalcule pas, sa perte serait définitive.';
