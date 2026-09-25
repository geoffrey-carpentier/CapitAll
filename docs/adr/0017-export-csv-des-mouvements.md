# 0017 — Contrat de l'export CSV des mouvements

- **Date** : 27 août 2026, complété les 5 et 6 septembre 2026
- **Statut** : acceptée

## Contexte

Les données saisies appartiennent à l'utilisateur, et il doit pouvoir les ressortir — pour les conserver, les recouper dans un tableur, ou quitter l'application. Un export sans contrat précis devient vite illisible : séparateur discutable selon la langue du tableur, encodage perdu, colonnes qui changent d'ordre d'une version à l'autre.

## Décision

Une route dédiée, sous l'espace du compte, exporte **les mouvements de l'utilisateur authentifié**, et rien d'autre.

Contrat, stable :

- dix colonnes, dans cet ordre : `date`, `type`, `actif`, `classe`, `quantite`, `prix_unitaire`, `frais`, `frais_montant`, `frais_unite`, `montant` ;
- séparateur point-virgule, encodage UTF-8 avec marque d'ordre des octets, pour que les tableurs francophones ouvrent le fichier correctement ;
- tri chronologique ;
- les montants sont ceux du moteur, à l'euro près de ses règles, et non recalculés pour l'occasion ;
- nom de fichier daté : `walletwatch-mouvements-AAAA-MM-JJ.csv`.

Les valeurs commençant par un caractère que les tableurs interprètent comme une formule sont neutralisées à l'écriture.

## Conséquences

- Le fichier s'ouvre sans manipulation dans un tableur francophone, et se relit sans ambiguïté par un programme.
- Toute modification de ce contrat casse les fichiers déjà produits chez l'utilisateur : elle demande une décision, et non un ajustement discret.
- L'export ne couvre que les mouvements : ni le profil, ni les seuils, ni les relevés. Un export complet des données personnelles reste à définir si l'application s'ouvre à des tiers.
