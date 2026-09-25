# 0008 — Cache Redis des cours et durées de vie par classe

- **Date** : 14 juillet 2026, durées fixées le 16 juillet 2026
- **Statut** : acceptée

## Contexte

Chaque consultation du tableau de bord demande le cours de chaque position. Sans cache, dix positions consultées trois fois dans la journée consomment trente appels de quota chez des fournisseurs qui en offrent peu, et l'affichage dépend entièrement de leur disponibilité.

Un cache mémoire dans le processus aurait suffi à un seul serveur, mais il disparaît à chaque redémarrage et ne se partage pas.

## Décision

Redis, avec deux familles de clés :

- `cours:v2:{TYPE}:{SYMBOLE}`, avec durée de vie, sert le cours frais ;
- `cours:v2:dernier-connu:{TYPE}:{SYMBOLE}`, **sans durée de vie**, sert de repli quand un fournisseur est indisponible. La date du cours est alors affichée à l'utilisateur.

Les durées de vie dépendent de la classe d'actif, parce que leur rythme de cotation diffère : cryptomonnaies deux minutes, actions cinq minutes, métaux dix minutes, devises une heure — les taux de référence ne changeant qu'une fois par jour.

Un cours s'identifie par le couple **(type, symbole)**, jamais par le symbole seul : un même sigle peut désigner des instruments de classes différentes, et le cache est commun à tous les comptes.

Aucune fonction du cache ne lève d'exception : une panne de cache dégrade vers un appel direct au fournisseur, elle ne fait jamais échouer la requête de l'utilisateur. Les appels au cache sont bornés dans le temps.

## Conséquences

- Redis est un accélérateur et un filet, jamais une source de vérité : l'application fonctionne sans lui, plus lentement et avec moins de tolérance aux pannes.
- Les clés du dernier cours connu n'expirant pas, elles ne doivent pas être purgées à l'aveugle en exploitation : ce sont elles qui portent le repli.
- Le préfixe porte une version, pour qu'un changement de format n'oblige pas à supprimer des clés que rien ne remplacerait.
- Redis n'a pas de volume persistant dans la pile actuelle : un redémarrage vide le repli. C'est acceptable en démonstration, pas en exploitation réelle.
