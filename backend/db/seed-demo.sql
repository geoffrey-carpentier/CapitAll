-- Jeu de démonstration WalletWatch
--
-- A exécuter APRÈS schema.sql, sur une base déjà créée, avec un rôle propriétaire :
--   psql -d <base> -f backend/db/seed-demo.sql
--
-- Ce script est distinct de seed.sql et ne le remplace pas. seed.sql amorce un
-- portefeuille court pour le développement et RÉINITIALISE LA BASE ENTIÈRE : il vide
-- toutes les tables. Celui-ci ne vide rien. Il ne touche qu'à ses propres comptes,
-- désignés nommément ci-dessous, et laisse intacts les utilisateurs, actifs,
-- mouvements, seuils et historiques de tous les autres.
--
-- Il est rejouable : la suppression préalable porte sur les seuls comptes de
-- démonstration, et la cascade du schéma emporte leurs actifs, mouvements, seuils et
-- relevés. Deux exécutions successives donnent le même état, sans doublon. Les
-- séquences ne sont pas réinitialisées : le faire créerait des identifiants en conflit
-- avec les données conservées.
--
-- Comptes créés (mots de passe de démonstration, sans équivalent réel) :
--   demo@walletwatch.fr          / Demo1234!  portefeuille complet, treize mois d'historique
--   demo-nouveau@walletwatch.fr  / Demo1234!  compte sans aucune position, pour l'état vide
--   demo-suspendu@walletwatch.fr / Demo1234!  compte désactivé, la connexion est refusée

BEGIN;

-- Le hachage bcrypt est réellement calculé en base, avec l'algorithme et le coût que le
-- serveur emploie ($2a$, coût 10 - voir COUT_HACHAGE dans services/authentification.js).
-- Aucune empreinte n'est recopiée d'ailleurs : elle serait invérifiable et se
-- désaccorderait le jour où le coût change.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Remise à zéro strictement bornée aux trois comptes. Rien d'autre n'est touché.
DELETE FROM utilisateur
WHERE email IN ('demo@walletwatch.fr', 'demo-nouveau@walletwatch.fr', 'demo-suspendu@walletwatch.fr');

INSERT INTO utilisateur (email, mot_de_passe_hache, pseudo, role, actif) VALUES
    ('demo@walletwatch.fr',          crypt('Demo1234!', gen_salt('bf', 10)), 'Camille Berger',  'utilisateur', true),
    ('demo-nouveau@walletwatch.fr',  crypt('Demo1234!', gen_salt('bf', 10)), 'Noé Vasseur',     'utilisateur', true),
    ('demo-suspendu@walletwatch.fr', crypt('Demo1234!', gen_salt('bf', 10)), 'Compte suspendu', 'utilisateur', false);

-- Neuf positions, les quatre classes d'actifs.
--
-- Aucune n'est servie par Finnhub : les vingt valeurs que ce fournisseur couvre restent
-- sélectionnables, mais son offre gratuite est de trente appels par jour, et une
-- démonstration qui les épuiserait s'arrêterait au mauvais moment. Le catalogue complet
-- se montre par GET /api/symboles, qui n'interroge aucun fournisseur.
INSERT INTO actif (utilisateur_id, type, symbole, nom, date_ajout)
SELECT u.id, v.type, v.symbole, v.nom, now() - v.jours_ajout * INTERVAL '1 day'
FROM utilisateur u
JOIN (VALUES
    ('crypto', 'BTC',  'Bitcoin',               400),
    ('crypto', 'ETH',  'Ethereum',              390),
    ('crypto', 'SOL',  'Solana',                360),
    ('metal',  'XAU',  'Or',                    380),
    ('metal',  'XPT',  'Platine',               180),
    ('devise', 'USD',  'Dollar américain',      370),
    ('devise', 'CHF',  'Franc suisse',          200),
    ('action', 'AAPL', 'Apple Inc.',            365),
    ('action', 'MSFT', 'Microsoft Corporation', 340)
) AS v(type, symbole, nom, jours_ajout) ON true
WHERE u.email = 'demo@walletwatch.fr';

-- Mouvements.
--
-- « jours » est l'ancienneté en jours. L'ordre chronologique est celui de la lecture, et
-- la quantité détenue reste positive à chaque instant de l'historique : aucune vente ni
-- sortie n'excède ce qui est détenu à sa date, y compris rétrospectivement. Un contrôle
-- en fin de script le vérifie et refuse le jeu entier dans le cas contraire.
--
-- Les frais sont donnés dans leur unité de prélèvement et dans leur contre-valeur en
-- euros (D89). Les deux coïncident tant que l'unité est l'euro, ce qu'impose la
-- contrainte transaction_frais_euros_coherents ; le renfort ETH porte le cas où elles
-- diffèrent.
INSERT INTO transaction (actif_id, sens, quantite, prix_unitaire, frais, frais_montant, frais_unite, date_transaction, note)
SELECT a.id, t.sens, t.quantite, t.prix_unitaire, t.frais, t.frais_montant, t.frais_unite,
       now() - t.jours * INTERVAL '1 day' + t.heure * INTERVAL '1 hour', t.note
FROM actif a
JOIN (VALUES
    -- Bitcoin : renforcé deux fois, allégé une fois, encore détenu. Forte plus-value
    -- latente, et une plus-value réalisée par l'allègement.
    ('BTC',  'achat',                 0.35000000,  28500.00,   12.00, 12.00,      'EUR', 400,  9, 'Première ligne'),
    ('BTC',  'achat',                 0.25000000,  41200.00,    9.00,  9.00,      'EUR', 300, 14, 'Renforcement'),
    ('BTC',  'vente',                 0.15000000,  52800.00,   11.00, 11.00,      'EUR', 190, 11, 'Prise de bénéfice partielle'),
    ('BTC',  'achat',                 0.10000000,  58900.00,    7.00,  7.00,      'EUR', 120, 16, NULL),

    -- Ethereum : frais retenus en ETH par la plateforme, et un transfert sortant qui
    -- n'est pas une vente - la quantité sort sans produit en euros.
    ('ETH',  'achat',                 3.50000000,   1620.00,    5.20,  5.20,      'EUR', 390, 10, NULL),
    ('ETH',  'achat',                 2.00000000,   2480.00,    8.15,  0.00320000, 'ETH', 280, 15, 'Renfort, frais retenus en ETH'),
    ('ETH',  'sortie_non_marchande',  0.25000000,      0.00,    0.00,  0.00,      'EUR', 210, 12, 'Transfert vers portefeuille froid'),
    ('ETH',  'achat',                 1.20000000,   2910.00,    6.40,  6.40,      'EUR',  90, 13, NULL),

    -- Solana : position entièrement soldée à perte. Elle ne figure plus parmi les
    -- positions détenues, mais sa moins-value réalisée reste au compte.
    ('SOL',  'achat',                40.00000000,    145.00,    4.00,  4.00,      'EUR', 360, 11, NULL),
    ('SOL',  'achat',                25.00000000,    118.00,    3.00,  3.00,      'EUR', 280, 17, 'Moyenne à la baisse'),
    ('SOL',  'vente',                65.00000000,     96.50,    5.00,  5.00,      'EUR', 150, 10, 'Sortie complète, position soldée'),

    -- Métaux, cotés à l'once troy (D88).
    ('XAU',  'achat',                 2.00000000,   1690.00,   18.00, 18.00,      'EUR', 380, 12, 'Deux onces'),
    ('XAU',  'achat',                 1.50000000,   2240.00,   15.00, 15.00,      'EUR', 260, 14, NULL),
    ('XPT',  'achat',                 5.00000000,    890.00,   12.00, 12.00,      'EUR', 180, 11, 'Diversification métaux'),

    -- Devises : le dollar est en moins-value latente, et un allègement a figé une
    -- moins-value réalisée. Toutes les positions ne gagnent pas.
    ('USD',  'achat',              6000.00000000,      0.9350,  0.00,  0.00,      'EUR', 370, 10, 'Constitution poche dollar'),
    ('USD',  'vente',              1500.00000000,      0.9050,  0.00,  0.00,      'EUR', 240, 15, 'Allègement à perte'),
    ('CHF',  'achat',              2500.00000000,      1.0450,  0.00,  0.00,      'EUR', 200, 12, NULL),

    -- Actions servies par le plan gratuit de FMP.
    ('AAPL', 'achat',                25.00000000,    142.30,    2.50,  2.50,      'EUR', 365, 15, NULL),
    ('AAPL', 'achat',                15.00000000,    165.80,    2.50,  2.50,      'EUR', 250, 16, 'Renforcement'),
    ('AAPL', 'vente',                10.00000000,    231.40,    2.50,  2.50,      'EUR', 100, 14, 'Allègement'),
    ('MSFT', 'achat',                12.00000000,    289.60,    2.50,  2.50,      'EUR', 340, 11, NULL),
    ('MSFT', 'achat',                 8.00000000,    372.10,    2.50,  2.50,      'EUR', 160, 15, NULL)
) AS t(symbole, sens, quantite, prix_unitaire, frais, frais_montant, frais_unite, jours, heure, note)
  ON a.symbole = t.symbole
WHERE a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'demo@walletwatch.fr');

-- Seuils : deux déjà franchis, deux en cours, un désactivé. Les statuts posés ici sont
-- un état de départ ; le serveur les réévalue à chaque actualisation du portefeuille.
INSERT INTO alerte (utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil, statut, date_creation, date_declenchement)
SELECT a.utilisateur_id, a.id, 'actif', s.sens, s.valeur, s.statut,
       now() - s.jours * INTERVAL '1 day',
       CASE WHEN s.statut = 'declenchee' THEN now() - (s.jours / 2) * INTERVAL '1 day' END
FROM actif a
JOIN (VALUES
    ('XAU',  'au_dessus',  3000.00,  'declenchee', 180),
    ('AAPL', 'au_dessus',   250.00,  'declenchee', 140),
    ('BTC',  'au_dessus', 80000.00,  'active',      90),
    ('ETH',  'en_dessous', 1500.00,  'active',      60),
    ('USD',  'au_dessus',     1.05,  'desactivee', 200)
) AS s(symbole, sens, valeur, statut, jours) ON a.symbole = s.symbole
WHERE a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'demo@walletwatch.fr');

-- Un seuil sur le patrimoine total, encore à atteindre : l'écart restant avant
-- franchissement a ainsi quelque chose à afficher.
INSERT INTO alerte (utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil, statut, date_creation)
SELECT id, NULL, 'capital_total', 'au_dessus', 120000.00, 'active', now() - 150 * INTERVAL '1 day'
FROM utilisateur WHERE email = 'demo@walletwatch.fr';

-- ---------------------------------------------------------------------------
-- Historique de marché
--
-- CES COURS SONT SYNTHÉTIQUES. Ils ne proviennent d'aucun fournisseur et ne reproduisent
-- aucune cotation réelle : ils n'existent que pour donner une courbe aux écrans de
-- démonstration. Un historique de mouvements ne crée pas un historique de cours, et
-- aucun des fournisseurs employés ne rend ses cours passés - ils ne sont donc pas
-- reconstituables après coup, ce qui est la raison d'être de ces deux tables de relevés.
--
-- La série est déterministe : aucune fonction aléatoire n'y intervient, l'ondulation
-- venant d'un sinus décalé par le rang de l'actif. Deux exécutions produisent les mêmes
-- courbes, ce qui permet de s'appuyer dessus dans une vérification ou une capture.
--
-- Chaque actif interpole entre un prix de départ et un prix d'arrivée choisis pour
-- rester cohérents à la fois avec le prix de revient issu des mouvements ci-dessus et
-- avec l'ordre de grandeur des cours réels du 06/09/2026 : le jour où les vrais cours
-- arrivent, la courbe ne fait pas de marche d'escalier.
-- ---------------------------------------------------------------------------

CREATE TEMPORARY TABLE serie_demo (
    symbole     VARCHAR(20),
    prix_debut  NUMERIC,
    prix_fin    NUMERIC,
    amplitude   NUMERIC,
    rang        INTEGER
) ON COMMIT DROP;

INSERT INTO serie_demo VALUES
    ('BTC',  34000.0000, 68500.0000, 0.090, 1),
    ('ETH',   1950.0000,  2145.0000, 0.110, 2),
    ('SOL',    132.0000,    88.0000, 0.130, 3),
    ('XAU',   1980.0000,  3810.0000, 0.045, 4),
    ('XPT',    860.0000,  1570.0000, 0.060, 5),
    ('USD',      0.9350,     0.8604, 0.020, 6),
    ('CHF',      1.0400,     1.0720, 0.015, 7),
    ('AAPL',   158.0000,   275.3000, 0.070, 8),
    ('MSFT',   315.0000,   395.0000, 0.065, 9);

-- 394 jours, et non un compte rond : la série commence six jours après le premier achat,
-- jamais avant. Une série qui débuterait sur un portefeuille encore vide ferait partir la
-- courbe de zéro, ce qui se lit comme une panne, et rendrait la performance « depuis le
-- premier relevé » incalculable faute de base de comparaison non nulle. La fenêtre couvre
-- malgré tout les cinq plages du sélecteur, jusqu'à « depuis l'origine ».
INSERT INTO snapshot_cours (actif_id, date_snapshot, cours_eur, quantite)
SELECT a.id,
       jour::date,
       GREATEST(ROUND((
           s.prix_debut
           + (s.prix_fin - s.prix_debut) * ((jour::date - (CURRENT_DATE - 393))::numeric / 393)
           + s.prix_debut * s.amplitude * SIN((((jour::date - (CURRENT_DATE - 393)) + s.rang * 13)::numeric) / 23.0)
       )::numeric, 8), 0.00000001),
       COALESCE((
           SELECT SUM(CASE WHEN t.sens = 'achat' THEN t.quantite ELSE -t.quantite END)
           FROM transaction t
           WHERE t.actif_id = a.id
             AND t.date_transaction::date <= jour::date
       ), 0)
FROM actif a
JOIN serie_demo s ON s.symbole = a.symbole
CROSS JOIN generate_series(CURRENT_DATE - 393, CURRENT_DATE, INTERVAL '1 day') AS jour
WHERE a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'demo@walletwatch.fr');

-- La valorisation totale n'est pas une seconde série inventée : elle est la somme des
-- positions au cours du jour. Les deux courbes de l'application disent ainsi la même
-- chose, ce qu'une génération indépendante ne garantirait pas.
INSERT INTO snapshot_valorisation (utilisateur_id, date_snapshot, valeur_totale_eur)
SELECT (SELECT id FROM utilisateur WHERE email = 'demo@walletwatch.fr'),
       sc.date_snapshot,
       ROUND(SUM(sc.cours_eur * sc.quantite), 2)
FROM snapshot_cours sc
JOIN actif a ON a.id = sc.actif_id
WHERE a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'demo@walletwatch.fr')
GROUP BY sc.date_snapshot;

-- ---------------------------------------------------------------------------
-- Contrôles. Ils ne corrigent rien : ils empêchent le jeu d'entrer en base s'il est
-- faux. Une donnée de démonstration incohérente est pire qu'une base vide, parce
-- qu'elle ne se voit qu'à la démonstration.
-- ---------------------------------------------------------------------------

-- Aucun solde négatif, à aucun instant de l'historique. Le contrôle rejoue les
-- mouvements dans l'ordre et regarde le cumul après chacun d'eux, plutôt que le seul
-- solde final : c'est entre deux lignes qu'une erreur d'ordonnancement se voit.
DO $$
DECLARE fautif RECORD;
BEGIN
    SELECT a.symbole AS symbole, c.date_transaction AS date_transaction, c.cumul AS cumul
    INTO fautif
    FROM (
        SELECT t.actif_id, t.date_transaction,
               SUM(CASE WHEN t.sens = 'achat' THEN t.quantite ELSE -t.quantite END)
                   OVER (PARTITION BY t.actif_id ORDER BY t.date_transaction, t.id) AS cumul
        FROM transaction t
    ) c
    JOIN actif a ON a.id = c.actif_id
    WHERE a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'demo@walletwatch.fr')
      AND c.cumul < 0
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Jeu de démonstration invalide : % tombe à % le %',
            fautif.symbole, fautif.cumul, fautif.date_transaction;
    END IF;
END
$$;

-- La quantité portée par chaque relevé de cours doit être celle qui découle des
-- mouvements à cette date, sans quoi le graphe de la fiche et le tableau des positions
-- se contrediraient.
DO $$
DECLARE ecarts INTEGER;
BEGIN
    SELECT COUNT(*) INTO ecarts
    FROM snapshot_cours sc
    JOIN actif a ON a.id = sc.actif_id
    WHERE a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'demo@walletwatch.fr')
      AND sc.quantite <> COALESCE((
          SELECT SUM(CASE WHEN t.sens = 'achat' THEN t.quantite ELSE -t.quantite END)
          FROM transaction t
          WHERE t.actif_id = sc.actif_id
            AND t.date_transaction::date <= sc.date_snapshot
      ), 0);

    IF ecarts > 0 THEN
        RAISE EXCEPTION 'Jeu de démonstration invalide : % relevés portent une quantité incohérente', ecarts;
    END IF;
END
$$;

COMMIT;

-- Récapitulatif, affiché à l'exécution.
SELECT u.email,
       u.pseudo,
       u.actif AS compte_actif,
       (SELECT COUNT(*) FROM actif a WHERE a.utilisateur_id = u.id)                          AS actifs,
       (SELECT COUNT(*) FROM transaction t
          JOIN actif a ON a.id = t.actif_id WHERE a.utilisateur_id = u.id)                   AS mouvements,
       (SELECT COUNT(*) FROM alerte al WHERE al.utilisateur_id = u.id)                       AS seuils,
       (SELECT COUNT(*) FROM snapshot_valorisation s WHERE s.utilisateur_id = u.id)          AS jours_historique
FROM utilisateur u
WHERE u.email LIKE 'demo%@walletwatch.fr'
ORDER BY u.email;
