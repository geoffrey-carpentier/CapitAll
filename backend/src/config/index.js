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
  // REDIS_URL ne figure pas parmi les variables obligatoires, contrairement aux deux
  // précédentes : le cache est une optimisation, pas une dépendance. Sans Redis
  // joignable, l'application démarre et sert les cours en appelant directement les
  // fournisseurs. Une valeur par défaut suffit donc en développement.
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  // Origine autorisée à consommer l'API. En développement, c'est le serveur de Vite ;
  // en production, le domaine qui sert l'interface. La valeur par défaut évite d'avoir
  // à renseigner la variable sur un poste de développement.
  origineAutorisee: process.env.ORIGINE_AUTORISEE || 'http://localhost:5173',
  // Clés optionnelles : l'API reste utilisable pour les trois autres classes d'actif
  // lorsqu'aucun fournisseur boursier n'est configuré. L'adaptateur actions applique
  // FMP -> Finnhub -> Alpha Vantage parmi les clés réellement disponibles.
  fmpApiKey: process.env.FMP_API_KEY || '',
  finnhubApiKey: process.env.FINNHUB_API_KEY || '',
  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || '',
  // Affiche le jeton de réinitialisation dans la réponse au lieu de l'envoyer par
  // courriel, le projet n'ayant pas de service d'envoi. C'est une commodité de
  // démonstration, et elle a un coût qu'il faut nommer : la présence ou l'absence du
  // jeton dans la réponse révèle si l'adresse correspond à un compte. Elle est donc
  // fermée par défaut, et n'a rien à faire sur un déploiement réel.
  afficherJetonReinitialisation: process.env.AFFICHER_JETON_REINITIALISATION === 'true',
});

module.exports = config;
