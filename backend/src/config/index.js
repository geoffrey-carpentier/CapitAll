// Point d'entrée unique de la configuration. Le reste du back-end lit ce module
// plutôt que process.env : les variables sont contrôlées une seule fois, au démarrage,
// et une configuration incomplète arrête le serveur au lieu de produire des erreurs
// obscures plus tard (connexion refusée, jeton non signable).

// Le fichier .env local n'est pas lu en environnement de test : les tests doivent
// donner le même résultat sur n'importe quel poste, sans dépendre de sa configuration.
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

const LONGUEUR_MINIMALE_SECRET = 32;

const VARIABLES_OBLIGATOIRES = ['DATABASE_URL', 'JWT_SECRET'];

function verifierEnvironnement() {
  const manquantes = VARIABLES_OBLIGATOIRES.filter((nom) => !process.env[nom]);

  if (manquantes.length > 0) {
    throw new Error(
      `Configuration incomplète. Variables d'environnement manquantes : ${manquantes.join(', ')}. ` +
        'Copier backend/.env.example vers backend/.env et les renseigner.'
    );
  }

  // Un secret court rend la signature du jeton attaquable par force brute.
  if (process.env.JWT_SECRET.length < LONGUEUR_MINIMALE_SECRET) {
    throw new Error(
      `JWT_SECRET est trop court : ${LONGUEUR_MINIMALE_SECRET} caractères au minimum sont exigés.`
    );
  }
}

verifierEnvironnement();

const config = Object.freeze({
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION || '2h',
});

module.exports = config;
