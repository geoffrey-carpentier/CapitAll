// Application des migrations SQL versionnées.
//
// Le dépôt contenait des migrations écrites et rejouables, mais rien ne disait
// lesquelles avaient déjà été passées sur une base donnée : la réponse vivait dans la
// mémoire de celui qui les avait lancées. Ce script tient ce registre en base, à côté
// des données qu'il décrit.
//
//   node backend/db/migrer.js            applique ce qui manque
//   node backend/db/migrer.js --etat     affiche l'état sans rien écrire
//
// Trois garanties, et rien de plus :
//
//   1. Un verrou consultatif PostgreSQL empêche deux exécutions simultanées de se
//      marcher dessus. Il est pris sur la connexion, et libéré avec elle.
//   2. Chaque migration s'applique dans sa propre transaction : elle passe entièrement
//      ou pas du tout, et un échec au milieu du lot laisse les précédentes acquises.
//   3. L'empreinte du fichier est conservée. Modifier une migration déjà appliquée est
//      détecté et refusé : deux bases prétendraient sinon porter le même schéma en
//      ayant exécuté des instructions différentes.
//
// Il n'y a délibérément pas de retour arrière automatique. Une migration qui rétrécit
// une échelle ou supprime une colonne détruit des données que le « down » ne
// reconstitue pas ; le présenter comme réversible serait mensonger. La reprise se fait
// par restauration d'une sauvegarde, ou par une migration corrective en avant.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pool } = require('../src/db');

const DOSSIER_MIGRATIONS = path.join(__dirname, 'migrations');

// Identifiant arbitraire mais stable du verrou. Toute exécution concurrente de ce
// script attend, plutôt que d'appliquer la même migration deux fois.
const CLE_VERROU = 4207701;

const CREATION_REGISTRE = `
  CREATE TABLE IF NOT EXISTS migration_appliquee (
      nom          VARCHAR(200) PRIMARY KEY,
      empreinte    CHAR(64) NOT NULL,
      applique_le  TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

function empreinte(contenu) {
  return crypto.createHash('sha256').update(contenu).digest('hex');
}

// L'ordre lexicographique des noms est l'ordre chronologique : les fichiers sont
// préfixés par leur date au format AAAA-MM-JJ.
function lireMigrations() {
  return fs
    .readdirSync(DOSSIER_MIGRATIONS)
    .filter((nom) => nom.endsWith('.sql'))
    .sort()
    .map((nom) => {
      const contenu = fs.readFileSync(path.join(DOSSIER_MIGRATIONS, nom), 'utf8');
      return { nom, contenu, empreinte: empreinte(contenu) };
    });
}

async function etatDuRegistre(executer) {
  const { rows } = await executer(
    'SELECT nom, empreinte, applique_le FROM migration_appliquee'
  );
  return new Map(rows.map((ligne) => [ligne.nom, ligne]));
}

// Une migration déjà appliquée dont le fichier a changé depuis est une erreur de
// méthode, pas un cas à rattraper automatiquement : la corriger en base reviendrait à
// prétendre qu'elle a toujours été telle qu'on la lit aujourd'hui.
function verifierEmpreintes(migrations, dejaAppliquees) {
  const divergentes = migrations.filter((migration) => {
    const trace = dejaAppliquees.get(migration.nom);
    return trace && trace.empreinte !== migration.empreinte;
  });

  if (divergentes.length > 0) {
    const noms = divergentes.map((m) => m.nom).join(', ');
    throw new Error(
      `Migration déjà appliquée mais modifiée depuis : ${noms}. ` +
        'Écrire une nouvelle migration corrective plutôt que de réécrire celle-ci.'
    );
  }
}

async function appliquer(client, migration) {
  await client.query('BEGIN');
  try {
    await client.query(migration.contenu);
    await client.query(
      'INSERT INTO migration_appliquee (nom, empreinte) VALUES ($1, $2)',
      [migration.nom, migration.empreinte]
    );
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  }
}

async function main() {
  const seulementLEtat = process.argv.includes('--etat');
  const client = await pool.connect();

  try {
    await client.query(CREATION_REGISTRE);
    // Verrou de session : relâché à la libération du client, y compris sur erreur.
    await client.query('SELECT pg_advisory_lock($1)', [CLE_VERROU]);

    const migrations = lireMigrations();
    const dejaAppliquees = await etatDuRegistre(client.query.bind(client));
    verifierEmpreintes(migrations, dejaAppliquees);

    const manquantes = migrations.filter((m) => !dejaAppliquees.has(m.nom));

    if (seulementLEtat) {
      for (const migration of migrations) {
        const trace = dejaAppliquees.get(migration.nom);
        const etat = trace
          ? `appliquée le ${trace.applique_le.toISOString().slice(0, 10)}`
          : 'à appliquer';
        console.log(`${migration.nom.padEnd(50)} ${etat}`);
      }
      return;
    }

    if (manquantes.length === 0) {
      console.log('Schéma à jour : aucune migration à appliquer.');
      return;
    }

    for (const migration of manquantes) {
      console.log(`Application de ${migration.nom}`);
      await appliquer(client, migration);
    }

    console.log(`${manquantes.length} migration(s) appliquée(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((erreur) => {
  console.error(erreur.message);
  process.exitCode = 1;
});
