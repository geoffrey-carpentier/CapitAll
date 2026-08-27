import { useId, useMemo, useState } from 'react';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { api, ErreurApi } from '../services/api';
import { LIBELLES_CLASSE } from '../utils/classesActifs';
import Feuille from './Feuille';
import Champ from './Champ';
import Bouton from './Bouton';
import Montant from './Montant';
import Message from './Message';
import './FeuilleSeuil.css';

// Création d'un seuil de surveillance, sur un actif ou sur le patrimoine total.
//
// La feuille présente la valeur actuelle de la cible en grand, puis la bascule au-dessus
// ou en dessous, le champ de seuil et des décalages rapides qui le pré-remplissent à
// distance de cette valeur. Rien de tout cela n'est un calcul métier : la valeur
// affichée en grand est celle transmise par l'écran d'origine, et un décalage n'est
// qu'une proposition de saisie, revalidée comme toute autre valeur par le schéma du
// serveur. La règle de franchissement, elle, n'est jamais recalculée ici (D69) : la
// feuille ne fait qu'énoncer en clair qu'elle est inclusive et qu'elle ne joue qu'une
// fois, ce que le serveur applique déjà.

const SENS = [
  { code: 'au_dessus', libelle: 'Au-dessus de' },
  { code: 'en_dessous', libelle: 'En dessous de' },
];

const DECALAGES = [-10, -5, 5, 10];

const MOTIF_MONTANT = /^\d+(\.\d{1,2})?$/;

function normaliser(valeur) {
  return String(valeur ?? '')
    .trim()
    .replace(/[\s ]/g, '')
    .replace(',', '.');
}

// Application exacte d'un décalage en points de pourcentage à un montant à deux
// décimales, sans jamais passer par un nombre à virgule flottante : un décalage n'est
// qu'une proposition de saisie, mais la proposition doit être aussi exacte qu'une
// valeur saisie à la main, faute de quoi le champ afficherait un artefact d'arrondi.
// Le facteur reste toujours positif, les quatre décalages proposés étant compris entre
// -10 et +10 points, ce qui dispense de traiter un facteur négatif.
function decalerMontant(montant, pointsDePourcentage) {
  if (typeof montant !== 'string' || !MOTIF_MONTANT.test(montant)) {
    return null;
  }

  const [entiere, decimale = ''] = montant.split('.');
  const centimes = BigInt(entiere) * 100n + BigInt((decimale + '00').slice(0, 2));
  const facteur = 100n + BigInt(pointsDePourcentage);

  const produit = centimes * facteur;
  const quotient = produit / 100n;
  const reste = produit % 100n;
  const arrondi = reste * 2n >= 100n ? quotient + 1n : quotient;

  return `${arrondi / 100n}.${(arrondi % 100n).toString().padStart(2, '0')}`;
}

const CHAMPS_SERVEUR = ['type_cible', 'sens_seuil', 'valeur_seuil', 'actif_id'];

function erreursDuServeur(echec) {
  if (!(echec instanceof ErreurApi) || !Array.isArray(echec.champs)) {
    return null;
  }

  const erreurs = {};
  for (const { champ, message } of echec.champs) {
    if (CHAMPS_SERVEUR.includes(champ)) {
      erreurs[champ === 'actif_id' ? 'cible' : champ] = message;
    }
  }

  return Object.keys(erreurs).length > 0 ? erreurs : null;
}

export default function FeuilleSeuil({
  // Positions valorisées du portefeuille, avec leur cours ; capitalTotal est la valeur
  // totale déjà consolidée par le serveur. Les deux viennent de GET /api/portefeuille,
  // chargé par l'écran d'origine.
  actifs = [],
  capitalTotal = '0',
  cibleInitiale = 'capital_total',
  // Faux depuis l'écran de détail d'une position (E4) : celui-ci ne connaît qu'un
  // actif et ne charge pas la valeur totale du patrimoine. Retirer l'option évite
  // d'afficher une valeur actuelle trompeuse (zéro) si elle était sélectionnée, sans
  // pour autant obliger l'écran de détail à charger le portefeuille pour cette seule
  // occasion.
  permettrePatrimoineTotal = true,
  surFermeture,
  surEnregistrement,
}) {
  const { jeton } = useAuthentification();
  const identifiant = useId();

  const cibleCorrespondACetActif =
    cibleInitiale !== 'capital_total' &&
    actifs.some((position) => String(position.id) === String(cibleInitiale));

  const cibleInitialeValide = cibleCorrespondACetActif
    ? `actif:${cibleInitiale}`
    : !permettrePatrimoineTotal && actifs.length > 0
      ? `actif:${actifs[0].id}`
      : 'capital_total';

  const [cible, setCible] = useState(cibleInitialeValide);
  const [sens, setSens] = useState('au_dessus');
  const [valeurSeuil, setValeurSeuil] = useState('');
  const [quitte, setQuitte] = useState(false);
  const [erreurs, setErreurs] = useState({});
  const [messageServeur, setMessageServeur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const actifChoisi = useMemo(() => {
    if (cible === 'capital_total') {
      return null;
    }
    const id = cible.slice('actif:'.length);
    return actifs.find((position) => String(position.id) === id) ?? null;
  }, [cible, actifs]);

  const cibleActif = cible !== 'capital_total';
  const valeurActuelle = cibleActif ? actifChoisi?.cours_eur ?? null : capitalTotal;
  const nomCible = cibleActif
    ? actifChoisi
      ? `${actifChoisi.nom} (${actifChoisi.symbole})`
      : ''
    : 'Patrimoine total';

  const valeurNormalisee = normaliser(valeurSeuil);
  const erreurValidation =
    valeurNormalisee === ''
      ? 'Le seuil est obligatoire.'
      : !MOTIF_MONTANT.test(valeurNormalisee)
        ? 'Le seuil doit être un montant positif, avec au plus 2 décimales.'
        : Number(valeurNormalisee) <= 0
          ? 'Le seuil doit être strictement positif.'
          : null;

  const complet = erreurValidation === null && (!cibleActif || actifChoisi !== null);

  async function soumettre(evenement) {
    evenement.preventDefault();

    if (!complet) {
      setQuitte(true);
      return;
    }

    setEnvoi(true);
    setErreurs({});
    setMessageServeur(null);

    try {
      const creee = await api.creerAlerte(jeton, {
        type_cible: cibleActif ? 'actif' : 'capital_total',
        sens_seuil: sens,
        valeur_seuil: valeurNormalisee,
        ...(cibleActif ? { actif_id: Number(actifChoisi.id) } : {}),
      });

      surEnregistrement?.({
        alerte: creee,
        resume: `Seuil créé pour ${nomCible}.`,
      });
    } catch (echec) {
      const duServeur = erreursDuServeur(echec);
      if (duServeur) {
        setErreurs(duServeur);
      } else {
        setMessageServeur(echec.message);
      }
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Feuille
      titre={cibleActif && actifChoisi ? `Nouveau seuil — ${nomCible}` : 'Nouveau seuil'}
      surFermeture={surFermeture}
      verrouillee={envoi}
    >
      <form className="seuil" onSubmit={soumettre} noValidate>
        <div className="champ">
          <label className="champ__label" htmlFor={`${identifiant}-cible`}>
            Cible
          </label>
          <select
            id={`${identifiant}-cible`}
            className="champ__saisie"
            value={cible}
            onChange={(evenement) => setCible(evenement.target.value)}
            disabled={envoi}
          >
            {permettrePatrimoineTotal && (
              <option value="capital_total">Patrimoine total</option>
            )}
            {actifs.map((position) => (
              <option key={position.id} value={`actif:${position.id}`}>
                {position.nom} — {position.symbole} ({LIBELLES_CLASSE[position.type]})
              </option>
            ))}
          </select>
        </div>

        <div className="seuil__valeur-actuelle">
          <span className="seuil__valeur-actuelle-legende">Valeur actuelle</span>
          {valeurActuelle !== null ? (
            <Montant valeur={valeurActuelle} type="cours" taille="principal" />
          ) : (
            <span className="seuil__valeur-indisponible">
              Aucun cours disponible pour {actifChoisi?.symbole}.
            </span>
          )}
        </div>

        <fieldset className="seuil__sens" disabled={envoi}>
          <legend className="seuil__legende">Sens du seuil</legend>
          <div className="seuil__bascule">
            {SENS.map((option) => (
              <label
                key={option.code}
                className={`seuil__choix${sens === option.code ? ' seuil__choix--actif' : ''}`}
              >
                <input
                  type="radio"
                  name={`${identifiant}-sens`}
                  value={option.code}
                  checked={sens === option.code}
                  onChange={() => setSens(option.code)}
                  className="lecteur-ecran-seulement"
                />
                <span>{option.libelle}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Champ
          label="Seuil de déclenchement (€)"
          valeur={valeurSeuil}
          onChange={(evenement) => setValeurSeuil(evenement.target.value)}
          onBlur={() => setQuitte(true)}
          erreur={erreurs.valeur_seuil ?? (quitte ? erreurValidation : undefined)}
          obligatoire
          inputMode="decimal"
          autoComplete="off"
          disabled={envoi}
        />

        {erreurs.cible && (
          <p className="champ__erreur" role="alert">
            <span aria-hidden="true">⚠ </span>
            {erreurs.cible}
          </p>
        )}

        {/* Décalages rapides : une proposition de saisie, jamais une valeur imposée.
            Ils restent indisponibles tant que la valeur actuelle de la cible ne l'est
            pas non plus, faute de base à décaler. */}
        <div className="seuil__decalages" role="group" aria-label="Décalages rapides">
          {DECALAGES.map((points) => {
            const propose = valeurActuelle !== null ? decalerMontant(valeurActuelle, points) : null;
            return (
              <button
                key={points}
                type="button"
                className="seuil__decalage"
                disabled={envoi || propose === null}
                onClick={() => {
                  setValeurSeuil(propose);
                  setQuitte(true);
                }}
              >
                {points > 0 ? `+${points} %` : `${points} %`}
              </button>
            );
          })}
        </div>

        <p className="seuil__aide">
          <span aria-hidden="true">ⓘ </span>
          Le seuil est inclusif et le franchissement ne se produit qu'une fois : une fois
          l'alerte déclenchée, elle ne se redéclenche pas.
        </p>

        {messageServeur && <Message variante="erreur">{messageServeur}</Message>}

        <div className="feuille__actions">
          <Bouton variante="secondaire" onClick={surFermeture} desactive={envoi}>
            Annuler
          </Bouton>
          <Bouton type="submit" enCours={envoi}>
            Créer le seuil
          </Bouton>
        </div>
      </form>
    </Feuille>
  );
}
