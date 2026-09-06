-- Migration : heure du relevé quotidien sur les deux séries historiques (DATA-04)
-- Date : 06/09/2026
--
-- CE QUE LA COURBE NE DISAIT PAS. Le point du jour est écrit à la première consultation
-- de la journée, et jamais mis à jour ensuite (D49). La valeur retenue est donc « le
-- patrimoine à l'heure où l'utilisateur a ouvert l'application ce jour-là ». Une
-- connexion lundi à 8 h et une autre mardi à 22 h produisent deux points annoncés comme
-- distants d'un jour, alors que trente-huit heures et deux moments de marché les
-- séparent. La courbe est exacte point par point ; c'est son pas qui est irrégulier, et
-- rien ne le disait.
--
-- POURQUOI UNE COLONNE PLUTÔT QU'UNE TÂCHE PLANIFIÉE. Un relevé quotidien à heure fixe
-- réglerait la cause, mais impose un processus de fond, que D49 et D50 écartent
-- explicitement du périmètre. La colonne, elle, ne change rien au mécanisme : elle rend
-- lisible ce qu'il fait, et l'interface peut alors annoncer un relevé à heure variable
-- au lieu de laisser croire à un relevé de clôture.
--
-- NULLABLE, ET SANS VALEUR PAR DÉFAUT. Les points déjà enregistrés ont été relevés à une
-- heure que personne n'a conservée. Un DEFAULT now() les daterait tous de l'exécution de
-- cette migration : ce serait une valeur fausse, et indiscernable d'une vraie. Un NULL
-- se lit « heure inconnue », ce qui est exactement le cas.
--
-- LES DEUX SÉRIES, PAS UNE. La valorisation totale et le cours de chaque position sont
-- écrits au même instant, par le même déclencheur. N'instrumenter que la première ferait
-- dire deux choses différentes aux deux courbes de l'application.
--
-- RETOUR ARRIÈRE. Retirer la colonne ne perd que l'heure des relevés postérieurs à cette
-- migration ; aucune valeur de patrimoine n'en dépend.
--
-- À exécuter sur une base existante, avec un rôle propriétaire :
--   psql -d <base> -f backend/db/migrations/2026-09-06_heure-de-releve.sql
-- ou, avec le registre :
--   node backend/db/migrer.js

ALTER TABLE snapshot_valorisation
    ADD COLUMN IF NOT EXISTS heure_releve TIMESTAMPTZ;

ALTER TABLE snapshot_cours
    ADD COLUMN IF NOT EXISTS heure_releve TIMESTAMPTZ;

-- Contrôle de sortie, même exigence que les migrations précédentes : une migration ne
-- peut pas se déclarer appliquée sans l'être.
DO $$
DECLARE
    manquant text := '';
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'snapshot_valorisation'
          AND column_name = 'heure_releve'
    ) THEN
        manquant := manquant || 'snapshot_valorisation.heure_releve, ';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'snapshot_cours'
          AND column_name = 'heure_releve'
    ) THEN
        manquant := manquant || 'snapshot_cours.heure_releve, ';
    END IF;

    IF manquant <> '' THEN
        RAISE EXCEPTION 'Migration incomplète, éléments absents : %', rtrim(manquant, ', ');
    END IF;
END
$$;
