#!/bin/sh
# Joué une seule fois par le conteneur PostgreSQL, à la création du volume de données,
# après schema.sql puis seed.sql.
#
# schema.sql crée le rôle applicatif capitall_app avec un mot de passe de remplacement,
# volontairement inutilisable : un mot de passe réel n'a pas sa place dans un fichier
# versionné. Il est posé ici, depuis la variable d'environnement du conteneur, de sorte
# que l'API se connecte avec le rôle à moindre privilège et jamais avec le superutilisateur.

set -e

if [ -z "$CAPITALL_APP_PASSWORD" ]; then
    echo "CAPITALL_APP_PASSWORD n'est pas renseignée : le rôle applicatif resterait inutilisable." >&2
    exit 1
fi

# La substitution :'mdp' est faite par psql, qui se charge de l'échappement : le mot de
# passe n'est jamais concaténé dans la requête. Elle n'opère que sur une commande lue
# sur l'entrée standard ou dans un fichier, jamais sur celles passées par -c.
psql -v ON_ERROR_STOP=1 -v mdp="$CAPITALL_APP_PASSWORD" \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
ALTER ROLE capitall_app LOGIN PASSWORD :'mdp';
SQL
