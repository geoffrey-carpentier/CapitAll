-- Jeu de données de démonstration CapitAll
-- A exécuter APRÈS schema.sql, sur la base capitall, avec un rôle propriétaire
-- (le rôle applicatif capitall_app n'a pas les droits DDL nécessaires à l'extension).
--   psql -d capitall -f backend/db/seed.sql
--
-- Le script est idempotent : il vide les tables avant de réinsérer, il peut donc
-- être rejoué autant que nécessaire pour repartir d'un état propre.
--
-- Comptes de démonstration (mots de passe destinés au développement uniquement) :
--   admin@capitall.fr    / Admin1234!    (rôle admin)
--   user@capitall.fr     / User1234!     (rôle utilisateur, porteur du portefeuille)
--   suspendu@capitall.fr / Suspendu1234! (compte désactivé : la connexion est refusée)

-- pgcrypto fournit crypt() et gen_salt() : le hachage bcrypt est réellement calculé
-- en base, avec le même algorithme ($2a$, coût 10) que celui utilisé côté serveur.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Remise à zéro. RESTART IDENTITY réinitialise les séquences, CASCADE couvre les
-- tables filles ; l'ordre importe peu grâce à CASCADE.
TRUNCATE TABLE annonce, snapshot_cours, snapshot_valorisation, alerte, transaction, actif, utilisateur
    RESTART IDENTITY CASCADE;

-- Utilisateurs. Le rôle est fixé ici (jamais via une entrée applicative, D23).
--
-- Le troisième compte est volontairement désactivé : il rend le refus de connexion
-- démontrable sans avoir à modifier la base à la main avant chaque vérification.
INSERT INTO utilisateur (email, mot_de_passe_hache, pseudo, role, actif) VALUES
    ('admin@capitall.fr',    crypt('Admin1234!',    gen_salt('bf', 10)), 'Administrateur CapitAll', 'admin',       true),
    ('user@capitall.fr',     crypt('User1234!',     gen_salt('bf', 10)), 'Camille Durand',          'utilisateur', true),
    ('suspendu@capitall.fr', crypt('Suspendu1234!', gen_salt('bf', 10)), 'Compte suspendu',         'utilisateur', false);

-- Actifs suivis par le compte utilisateur, couvrant les quatre classes.
INSERT INTO actif (utilisateur_id, type, symbole, nom)
SELECT u.id, v.type, v.symbole, v.nom
FROM utilisateur u
JOIN (VALUES
    ('crypto', 'BTC',  'Bitcoin'),
    ('crypto', 'ETH',  'Ethereum'),
    ('devise', 'USD',  'Dollar américain'),
    ('metal',  'XAU',  'Or'),
    ('action', 'AAPL', 'Apple Inc.'),
    ('action', 'NVDA', 'NVIDIA Corporation')
) AS v(type, symbole, nom) ON true
WHERE u.email = 'user@capitall.fr';

-- Transactions d'achat et de vente. Les quantités vendues restent inférieures aux
-- quantités détenues (la règle est vérifiée côté serveur, on la respecte ici par
-- cohérence du jeu d'essai). jours = ancienneté en jours par rapport à aujourd'hui.
INSERT INTO transaction (actif_id, sens, quantite, prix_unitaire, frais, date_transaction, note)
SELECT a.id, t.sens, t.quantite, t.prix_unitaire, t.frais,
       now() - t.jours * INTERVAL '1 day', t.note
FROM actif a
JOIN (VALUES
    ('BTC',  'achat', 0.50,    54000.00, 15.00, 88, 'Achat initial'),
    ('BTC',  'achat', 0.30,    61000.00, 10.00, 52, 'Renforcement'),
    ('BTC',  'vente', 0.20,    63500.00,  8.00, 20, 'Prise de bénéfice partielle'),
    ('ETH',  'achat', 4.00,     2750.00,  6.00, 80, NULL),
    ('ETH',  'achat', 2.00,     3150.00,  5.00, 35, 'Renfort DCA'),
    ('USD',  'achat', 5000.00,     0.92,  0.00, 75, 'Constitution poche dollar'),
    ('XAU',  'achat', 2.00,     1780.00,  4.00, 70, 'Once d''or'),
    ('XAU',  'achat', 1.00,     1950.00,  3.00, 25, NULL),
    ('AAPL', 'achat', 20.00,     168.00,  1.00, 65, NULL),
    ('AAPL', 'vente', 5.00,      182.00,  1.00, 18, 'Allègement'),
    ('NVDA', 'achat', 10.00,     102.00,  1.00, 60, NULL),
    ('NVDA', 'achat', 5.00,      118.00,  1.00, 22, 'Renfort thématique IA')
) AS t(symbole, sens, quantite, prix_unitaire, frais, jours, note) ON a.symbole = t.symbole
WHERE a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'user@capitall.fr');

-- Alertes du compte utilisateur : une sur un actif, une sur le capital total.
INSERT INTO alerte (utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil, statut)
SELECT a.utilisateur_id, a.id, 'actif', 'au_dessus', 70000.00, 'active'
FROM actif a
WHERE a.symbole = 'BTC'
  AND a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'user@capitall.fr');

INSERT INTO alerte (utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil, statut)
SELECT id, NULL, 'capital_total', 'au_dessus', 45000.00, 'active'
FROM utilisateur
WHERE email = 'user@capitall.fr';

-- Annonces publiées par l'administrateur, dont une épinglée.
INSERT INTO annonce (auteur_id, titre, contenu, epinglee)
SELECT u.id, v.titre, v.contenu, v.epinglee
FROM utilisateur u
JOIN (VALUES
    ('Bienvenue sur CapitAll',
     'Votre tableau de bord regroupe désormais vos cryptomonnaies, devises, métaux et actions en une seule vue. Ajoutez vos transactions pour suivre votre prix de revient et vos plus-values.',
     true),
    ('Cours mis à jour automatiquement',
     'Les cours sont récupérés auprès de fournisseurs publics et rafraîchis régulièrement. En cas d''indisponibilité momentanée d''une source, le dernier cours connu est affiché avec sa date.',
     false),
    ('Alertes de seuil disponibles',
     'Vous pouvez définir des alertes sur un actif ou sur la valeur totale de votre portefeuille, et être prévenu lorsqu''un seuil est franchi.',
     false)
) AS v(titre, contenu, epinglee) ON true
WHERE u.email = 'admin@capitall.fr';

-- Historique de valorisation : 90 jours de snapshots journaliers pour le compte
-- utilisateur, afin que la courbe d'évolution du tableau de bord soit alimentée dès
-- le premier lancement (Q-C). Les cours passés des fournisseurs n'étant pas conservés,
-- ces valeurs ne seraient pas recalculables après coup : on les amorce donc ici.
-- La valeur suit une tendance haussière avec une ondulation et un léger bruit, pour
-- une courbe crédible sans être artificiellement lisse. Bornée à >= 0 par le schéma,
-- elle reste ici largement positive.
INSERT INTO snapshot_valorisation (utilisateur_id, date_snapshot, valeur_totale_eur)
SELECT (SELECT id FROM utilisateur WHERE email = 'user@capitall.fr'),
       jour::date,
       ROUND((
           24000
           + (jour::date - (CURRENT_DATE - 89)) * 130
           + SIN((jour::date - (CURRENT_DATE - 89)) / 7.0) * 1600
           + (random() - 0.5) * 900
       )::numeric, 2)
FROM generate_series(CURRENT_DATE - 89, CURRENT_DATE, INTERVAL '1 day') AS jour;

-- Historique de cours par position : les mêmes quatre-vingt-dix jours, déclinés actif
-- par actif, pour alimenter le graphe de cours de l'écran de détail et la colonne de
-- tendance sur trente jours du tableau des positions.
--
-- Deux différences assumées avec le bloc précédent.
--
-- La série est déterministe : aucune fonction aléatoire n'y intervient, l'ondulation
-- venant d'un sinus décalé par l'identifiant de l'actif. Deux exécutions du seed
-- produisent donc exactement les mêmes courbes, ce qui permet de s'y appuyer dans une
-- vérification. Le bloc de valorisation totale, antérieur, conserve son bruit
-- aléatoire : le rendre déterministe ne relève pas de ce lot.
--
-- Le cours part du prix du premier achat réel de l'actif et progresse d'environ
-- dix-huit pour cent sur la période. Il reste ainsi cohérent avec le prix de revient
-- calculé depuis les transactions du même jeu de données, sans quoi le graphe montrerait
-- une ligne de prix de revient sans rapport avec la courbe qu'elle traverse.
--
-- La quantité est celle réellement détenue ce jour-là, reconstituée depuis les
-- transactions. Elle vaut zéro avant le premier achat, ce qui est exact : la position
-- n'existait pas encore.
INSERT INTO snapshot_cours (actif_id, date_snapshot, cours_eur, quantite)
SELECT a.id,
       jour::date,
       ROUND((premier.prix * (
           1
           + (jour::date - (CURRENT_DATE - 89)) * 0.0020
           + SIN(((jour::date - (CURRENT_DATE - 89)) + a.id * 7) / 9.0) * 0.055
       ))::numeric, 2),
       COALESCE((
           SELECT SUM(CASE WHEN t.sens = 'achat' THEN t.quantite ELSE -t.quantite END)
           FROM transaction t
           WHERE t.actif_id = a.id
             AND t.date_transaction::date <= jour::date
       ), 0)
FROM actif a
JOIN LATERAL (
    SELECT t.prix_unitaire AS prix
    FROM transaction t
    WHERE t.actif_id = a.id
    ORDER BY t.date_transaction, t.id
    LIMIT 1
) AS premier ON true
CROSS JOIN generate_series(CURRENT_DATE - 89, CURRENT_DATE, INTERVAL '1 day') AS jour
WHERE a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'user@capitall.fr');
