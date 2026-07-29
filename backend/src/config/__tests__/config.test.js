// NODE_ENV vaut test sous Vitest : la configuration ne lit alors pas le fichier .env
// du poste, ce qui rend ces cas reproductibles ailleurs que sur la machine de
// développement. La variable n'est donc jamais supprimée dans les cas ci-dessous.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const SECRET_VALIDE = 'a'.repeat(32);
const URL_VALIDE = 'postgresql://utilisateur:secret@localhost:5432/capitall';

let environnementInitial;

// La configuration se contrôle au chargement du module : chaque cas doit repartir
// d'un cache de modules vide pour rejouer ce contrôle.
async function chargerConfig() {
  vi.resetModules();
  const module = await import('../index.js');
  return module.default;
}

beforeEach(() => {
  environnementInitial = { ...process.env };
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;
  delete process.env.PORT;
  delete process.env.JWT_EXPIRATION;
});

afterEach(() => {
  process.env = environnementInitial;
});

describe('chargement de la configuration', () => {
  it('expose les valeurs attendues quand tout est renseigné', async () => {
    process.env.DATABASE_URL = URL_VALIDE;
    process.env.JWT_SECRET = SECRET_VALIDE;
    process.env.PORT = '4321';

    const config = await chargerConfig();

    expect(config.databaseUrl).toBe(URL_VALIDE);
    expect(config.port).toBe(4321);
    expect(config.nodeEnv).toBe(process.env.NODE_ENV);
  });

  it('applique les valeurs par défaut du port et de la durée du jeton', async () => {
    process.env.DATABASE_URL = URL_VALIDE;
    process.env.JWT_SECRET = SECRET_VALIDE;

    const config = await chargerConfig();

    expect(config.port).toBe(5000);
    expect(config.jwtExpiration).toBe('2h');
  });

  it('refuse de démarrer si DATABASE_URL est absente', async () => {
    process.env.JWT_SECRET = SECRET_VALIDE;
    await expect(chargerConfig()).rejects.toThrow(/DATABASE_URL/);
  });

  it('refuse de démarrer si JWT_SECRET est absent', async () => {
    process.env.DATABASE_URL = URL_VALIDE;
    await expect(chargerConfig()).rejects.toThrow(/JWT_SECRET/);
  });

  // Le message liste toutes les variables manquantes d'un coup, pour éviter de les
  // découvrir une par une à chaque redémarrage.
  it('liste toutes les variables manquantes dans le même message', async () => {
    await expect(chargerConfig()).rejects.toThrow(/DATABASE_URL, JWT_SECRET/);
  });

  it('refuse un JWT_SECRET de moins de 32 caractères', async () => {
    process.env.DATABASE_URL = URL_VALIDE;
    process.env.JWT_SECRET = 'trop-court';
    await expect(chargerConfig()).rejects.toThrow(/32 caractères/);
  });

  it('renvoie un objet gelé', async () => {
    process.env.DATABASE_URL = URL_VALIDE;
    process.env.JWT_SECRET = SECRET_VALIDE;
    const config = await chargerConfig();
    expect(Object.isFrozen(config)).toBe(true);
  });
});
