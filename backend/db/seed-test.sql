-- Jeu de données des tests d'intégration.
--
-- Distinct de seed.sql, qui alimente la démonstration : celui-ci ne cherche pas à
-- ressembler à un portefeuille crédible, il installe les situations que les tests
-- doivent pouvoir observer. Il est entièrement déterministe — aucun random(), aucune
-- date relative au-delà du décalage en jours — pour que deux exécutions donnent
-- exactement le même état et qu'une assertion puisse porter sur une valeur précise.
--
-- Il n'est joué que par docker-compose.test.yml, sur la base isolée walletwatch_test.
-- Il ne doit jamais être exécuté sur une base de travail : le TRUNCATE initial
-- effacerait tout.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

TRUNCATE TABLE annonce, snapshot_cours, snapshot_valorisation, alerte, transaction, actif, utilisateur
    RESTART IDENTITY CASCADE;

-- Deux comptes distincts. Le second n'existe que pour prouver le cloisonnement : toute
-- lecture croisée doit rendre « introuvable » plutôt que « interdit » (D52).
INSERT INTO utilisateur (email, mot_de_passe_hache, pseudo, role, actif) VALUES
    ('titulaire@walletwatch.test', crypt('Titulaire1234!', gen_salt('bf', 10)), 'Titulaire',      'utilisateur', true),
    ('tiers@walletwatch.test',     crypt('Tiers1234!',     gen_salt('bf', 10)), 'Tiers',          'utilisateur', true),
    ('desactive@walletwatch.test', crypt('Desactive1234!', gen_salt('bf', 10)), 'Compte inactif', 'utilisateur', false);

-- Actifs du titulaire.
--
-- SHIB porte le cas de précision : son prix réel est très inférieur au centime, seuil
-- au-delà duquel la colonne NUMERIC(18,2) actuelle ne peut plus rien conserver. Le
-- laisser dans le jeu de test rend la perte observable sur une vraie base, là où les
-- sondes ne pouvaient l'établir que par lecture du code.
--
-- XAU porte le cas d'unité : la quantité est exprimée en onces troy, ce que la note
-- consigne explicitement, alors que l'interface l'affiche aujourd'hui en grammes.
INSERT INTO actif (utilisateur_id, type, symbole, nom)
SELECT u.id, v.type, v.symbole, v.nom
FROM utilisateur u
JOIN (VALUES
    ('crypto', 'BTC',  'Bitcoin'),
    ('crypto', 'SHIB', 'Shiba Inu'),
    ('crypto', 'ETH',  'Ethereum'),
    ('devise', 'USD',  'Dollar americain'),
    ('metal',  'XAU',  'Or'),
    ('action', 'AAPL', 'Apple Inc.')
) AS v(type, symbole, nom) ON true
WHERE u.email = 'titulaire@walletwatch.test';

-- Un actif chez le tiers, portant le même symbole qu'un actif du titulaire : une
-- lecture qui confondrait les deux comptes deviendrait visible immédiatement.
INSERT INTO actif (utilisateur_id, type, symbole, nom)
SELECT u.id, 'crypto', 'BTC', 'Bitcoin du tiers'
FROM utilisateur u
WHERE u.email = 'tiers@walletwatch.test';

-- Mouvements du titulaire.
--
-- La séquence BTC est celle dont dépend l'édition : la vente du jour 20 ne tient que
-- par les deux achats antérieurs. Retirer le premier achat doit être refusé, et
-- corriger son prix doit rester possible — c'est l'objet du lot L3.
--
-- Les quatre positions à quantité 1 servent la répartition : en leur donnant des cours
-- choisis, un test reproduit exactement le cas de reliquat qui produit aujourd'hui un
-- pourcentage négatif, sans dépendre d'un fournisseur.
-- Les frais sont donnes dans leur unite de prelevement et dans leur contre-valeur en
-- euros (D89). Les deux coincident quand l'unite est l'euro, ce que la contrainte de
-- coherence impose ; la position ETH porte le cas ou elles different.
INSERT INTO transaction (actif_id, sens, quantite, prix_unitaire, frais, frais_montant, frais_unite, date_transaction, note)
SELECT a.id, t.sens, t.quantite, t.prix_unitaire, t.frais, t.frais_montant, t.frais_unite,
       TIMESTAMPTZ '2026-01-01 12:00:00+00' + t.jours * INTERVAL '1 day', t.note
FROM actif a
JOIN (VALUES
    ('BTC',  'achat',                0.50,       54000.00,      15.00, 15.00,       'EUR',  0, 'Achat initial, dont depend la vente'),
    ('BTC',  'achat',                0.30,       61000.00,      10.00, 10.00,       'EUR', 30, 'Renforcement'),
    ('BTC',  'vente',                0.20,       63500.00,       8.00,  8.00,       'EUR', 60, 'Vente dependant des achats anterieurs'),
    ('SHIB', 'achat',          5000000.00, 0.000012340000, 0.00,  0.00,             'EUR', 10, 'Cours sous le centime : 0,00001234 EUR l unite'),
    ('ETH',  'achat',               0.398,        2500.00,       5.00,  0.002,      'ETH', 10, 'Frais retenus par la plateforme dans l actif achete'),
    ('ETH',  'sortie_non_marchande', 0.05,           0.00,       0.00,  0.00,       'EUR', 40, 'Transfert vers un portefeuille personnel : ni vente ni plus-value'),
    ('USD',  'achat',                1.00,           1.00,       0.00,  0.00,       'EUR', 10, NULL),
    ('XAU',  'achat',                2.00,        1780.00,       4.00,  4.00,       'EUR', 10, 'Once troy : quantite exprimee en onces, pas en grammes'),
    ('AAPL', 'achat',                1.00,         168.00,       0.00,  0.00,       'EUR', 10, NULL)
) AS t(symbole, sens, quantite, prix_unitaire, frais, frais_montant, frais_unite, jours, note) ON a.symbole = t.symbole
WHERE a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'titulaire@walletwatch.test');

INSERT INTO transaction (actif_id, sens, quantite, prix_unitaire, frais, frais_montant, frais_unite, date_transaction, note)
SELECT a.id, 'achat', 1.00, 50000.00, 0.00, 0.00, 'EUR', TIMESTAMPTZ '2026-01-01 12:00:00+00', 'Mouvement du tiers'
FROM actif a
WHERE a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'tiers@walletwatch.test');

-- Alerte de capital à seuil bas, active.
--
-- Elle porte le scénario du capital partiellement valorisé : si un seul cours manque,
-- le total consolidé tombe sous ce seuil et l'alerte se déclenche aujourd'hui sur une
-- valeur qui n'est pas le capital réel. Le seuil est franchement en dessous du
-- patrimoine complet, de sorte qu'un déclenchement signale forcement le defaut.
INSERT INTO alerte (utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil, statut)
SELECT id, NULL, 'capital_total', 'en_dessous', 500.00, 'active'
FROM utilisateur
WHERE email = 'titulaire@walletwatch.test';

-- Alerte sur actif, pour vérifier qu'elle reste évaluable lorsque son propre cours est
-- disponible, même si un autre cours du portefeuille manque.
INSERT INTO alerte (utilisateur_id, actif_id, type_cible, sens_seuil, valeur_seuil, statut)
SELECT a.utilisateur_id, a.id, 'actif', 'au_dessus', 70000.00, 'active'
FROM actif a
WHERE a.symbole = 'BTC'
  AND a.utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'titulaire@walletwatch.test');
