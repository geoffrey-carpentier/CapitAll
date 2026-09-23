// Adaptateur des actions américaines : FMP en source principale, Finnhub
// puis Alpha Vantage en replis. Les trois fournisseurs cotent en dollars ; la
// conversion vers la devise de référence passe donc par le taux USD -> EUR mis en
// cache par le service de cours, comme pour les métaux.

const { ErreurFournisseur } = require('../erreurs');
const { chaineDecimalePositive } = require('./valeur');
const {
  ECHELLE_PRIX,
  ECHELLE_TAUX,
  versUnites,
  versChaine,
  multiplier,
} = require('../utils/decimal');

const BASE_FMP = 'https://financialmodelingprep.com/stable';
const BASE_FINNHUB = 'https://finnhub.io/api/v1';
const BASE_ALPHA_VANTAGE = 'https://www.alphavantage.co/query';

// Un horodatage n'est pas un montant : le convertir en nombre ne coûte aucune précision
// utile. La conversion est explicite car le client HTTP rend les nombres en chaînes.
function horodatageUnix(secondes) {
  const valeur = Number(secondes);
  return Number.isFinite(valeur) && valeur > 0
    ? new Date(valeur * 1000).toISOString()
    : new Date().toISOString();
}

// Le prix est conservé sous forme de chaîne décimale : le convertir en nombre ferait
// perdre ici ce que la lecture du JSON vient précisément de préserver.
function validerPrix(prix, fournisseur, symbole) {
  const decimal = chaineDecimalePositive(prix);
  if (decimal === null) {
    throw new ErreurFournisseur(`${fournisseur} n'a pas renvoyé de prix pour ${symbole}.`);
  }
  return decimal;
}

function creerAdaptateurActions({
  recupererJson,
  obtenirTauxUsdEur,
  fmpApiKey,
  finnhubApiKey,
  alphaVantageApiKey,
}) {
  const fournisseurs = [
    {
      nom: 'FMP',
      cle: fmpApiKey,
      async interroger(symbole, cle) {
        const reponse = await recupererJson(
          `${BASE_FMP}/quote?symbol=${encodeURIComponent(symbole)}&apikey=${encodeURIComponent(cle)}`
        );
        const cotation = Array.isArray(reponse) ? reponse[0] : null;
        return {
          prixUsd: validerPrix(cotation?.price, 'FMP', symbole),
          horodatage: horodatageUnix(cotation?.timestamp),
          source: 'fmp',
        };
      },
    },
    {
      nom: 'Finnhub',
      cle: finnhubApiKey,
      async interroger(symbole, cle) {
        const reponse = await recupererJson(
          `${BASE_FINNHUB}/quote?symbol=${encodeURIComponent(symbole)}&token=${encodeURIComponent(cle)}`
        );
        return {
          prixUsd: validerPrix(reponse?.c, 'Finnhub', symbole),
          horodatage: horodatageUnix(reponse?.t),
          source: 'finnhub',
        };
      },
    },
    {
      nom: 'Alpha Vantage',
      cle: alphaVantageApiKey,
      async interroger(symbole, cle) {
        const reponse = await recupererJson(
          `${BASE_ALPHA_VANTAGE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbole)}&apikey=${encodeURIComponent(cle)}`
        );
        const cotation = reponse?.['Global Quote'];
        return {
          prixUsd: validerPrix(cotation?.['05. price'], 'Alpha Vantage', symbole),
          horodatage: cotation?.['07. latest trading day']
            ? new Date(`${cotation['07. latest trading day']}T00:00:00Z`).toISOString()
            : new Date().toISOString(),
          source: 'alpha-vantage',
        };
      },
    },
  ];

  async function getCours(symbole) {
    const symboleNormalise = symbole.toUpperCase();
    const disponibles = fournisseurs.filter(({ cle }) => Boolean(cle));

    if (disponibles.length === 0) {
      throw new ErreurFournisseur(
        "Aucune clé de fournisseur d'actions n'est configurée côté serveur."
      );
    }

    // Première étape : obtenir une cotation. Les fournisseurs sont essayés dans l'ordre,
    // chacun ne répondant que de sa propre indisponibilité.
    const echecs = [];
    let cotation = null;

    for (const fournisseur of disponibles) {
      try {
        cotation = await fournisseur.interroger(symboleNormalise, fournisseur.cle);
        break;
      } catch {
        echecs.push(fournisseur.nom);
      }
    }

    if (!cotation) {
      throw new ErreurFournisseur(
        `Cours indisponible pour ${symboleNormalise} auprès des fournisseurs configurés (${echecs.join(', ')}).`
      );
    }

    // Seconde étape, une seule fois : le taux de change, hors de la boucle, pour qu'une
    // panne de change ne soit pas imputée aux fournisseurs de cotation. Son échec est
    // requalifié pour dire de quelle étape il provient.
    let tauxUsdEur;
    try {
      tauxUsdEur = chaineDecimalePositive(await obtenirTauxUsdEur());
    } catch (erreur) {
      throw new ErreurFournisseur(
        `Cotation de ${symboleNormalise} obtenue, mais le taux de change USD vers EUR est ` +
          `indisponible (${erreur.message}) : la conversion vers la devise de référence ` +
          'ne peut pas être faite.'
      );
    }

    if (tauxUsdEur === null) {
      throw new ErreurFournisseur(
        `Cotation de ${symboleNormalise} obtenue, mais le taux de change USD vers EUR est ` +
          'inexploitable : la conversion vers la devise de référence ne peut pas être faite.'
      );
    }

    return {
      symbole: symboleNormalise,
      // Conversion en entiers, à l'échelle des prix : arrondir au centime à l'entrée
      // effacerait ce que le contrat numérique vient d'ouvrir.
      cours_eur: versChaine(
        multiplier(
          versUnites(cotation.prixUsd, ECHELLE_PRIX),
          ECHELLE_PRIX,
          versUnites(tauxUsdEur, ECHELLE_TAUX),
          ECHELLE_TAUX,
          ECHELLE_PRIX
        ),
        ECHELLE_PRIX
      ),
      horodatage: cotation.horodatage,
      source: cotation.source,
    };
  }

  return { getCours, source: 'actions' };
}

module.exports = {
  creerAdaptateurActions,
  BASE_FMP,
  BASE_FINNHUB,
  BASE_ALPHA_VANTAGE,
};
