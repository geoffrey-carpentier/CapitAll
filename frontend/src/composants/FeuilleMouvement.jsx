import { useEffect, useId, useMemo, useState } from 'react';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { api, ErreurApi } from '../services/api';
import {
  comparerDecimales,
  formaterQuantite,
  formaterQuantiteEnNature,
  CLASSES_QUANTITE,
} from '../utils/formatage';
import { LIBELLES_CLASSE } from '../utils/classesActifs';
import Feuille from './Feuille';
import Champ from './Champ';
import Bouton from './Bouton';
import Montant from './Montant';
import Variation from './Variation';
import JetonClasse from './JetonClasse';
import Message from './Message';
import './FeuilleMouvement.css';

// Saisie ou correction d'un mouvement : achat, vente ou sortie non marchande.
//
// L'effet de la saisie (montant, quantité après, prix de revient, plus-value) est
// affiché avant validation, mais il n'est pas calculé ici : le serveur rejoue
// l'historique de la position sans rien écrire. Une seconde implémentation de la
// moyenne pondérée côté interface finirait par diverger du moteur. Ce composant se
// limite aux contrôles de forme et à des comparaisons exactes, sans flottant.
//
// La saisie est toujours en euros : la bascule euro-dollar ne concerne que l'affichage,
// alors qu'un montant saisi est celui qui sera enregistré.

const SENS = [
  { code: 'achat', libelle: 'Achat' },
  { code: 'vente', libelle: 'Vente' },
  { code: 'sortie_non_marchande', libelle: 'Sortie' },
];

// Précisions des colonnes NUMERIC : dix-huit décimales pour une quantité ou un prix,
// deux pour un montant en euros. Elles doivent rester alignées sur les schémas Zod du
// serveur, qui reste seul décisionnaire : une borne plus stricte ici refuserait des
// valeurs que le serveur accepte.
const DECIMALES_QUANTITE = 18;
const DECIMALES_PRIX = 18;
const DECIMALES_MONTANT = 2;

const MOTIF_QUANTITE = new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_QUANTITE}})?$`);
const MOTIF_PRIX = new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_PRIX}})?$`);
const MOTIF_MONTANT = new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_MONTANT}})?$`);

// Unité de prélèvement des frais : l'euro, l'actif échangé (frais retenus par une
// plateforme crypto), ou un tiers actif, pour lequel aucun taux ne se déduit du
// mouvement et dont la contre-valeur doit donc être saisie.
const FRAIS_EN_EUROS = 'EUR';
const FRAIS_EN_ACTIF = 'actif';
const FRAIS_EN_TIERS = 'tiers';

// Confirmation remise à l'écran d'origine : un transfert ne doit pas être annoncé
// comme une vente.
const RESUMES = {
  achat: (quantite) => `Achat de ${quantite} enregistré.`,
  vente: (quantite) => `Vente de ${quantite} enregistrée.`,
  sortie_non_marchande: (quantite) => `Sortie de ${quantite} enregistrée.`,
};

// Les frais ne jouent pas le même rôle dans le calcul selon le sens du mouvement.
const AIDES_FRAIS = {
  achat: "Facultatif. Les frais d'achat entrent dans le prix de revient.",
  vente: 'Facultatif. Les frais de vente sont déduits de la plus-value réalisée.',
  sortie_non_marchande:
    "Facultatif. Les frais d'une sortie s'ajoutent à la valeur qui quitte le portefeuille.",
};

// Délai d'inactivité avant de demander le récapitulatif, pour ne pas envoyer une
// requête par caractère.
const DELAI_RECAPITULATIF = 350;

// Jour d'un instant dans le fuseau de l'utilisateur. L'heure UTC désignerait encore la
// veille juste après minuit.
function jourLocal(instant) {
  const decalage = instant.getTimezoneOffset() * 60000;
  return new Date(instant.getTime() - decalage).toISOString().slice(0, 10);
}

function aujourdhui() {
  return jourLocal(new Date());
}

// Le jour courant garde l'heure courante. Un jour passé est placé à midi UTC et non à
// minuit : minuit UTC se relirait la veille à l'ouest de Greenwich.
function versHorodatage(jour) {
  return jour === aujourdhui() ? new Date().toISOString() : `${jour}T12:00:00.000Z`;
}

// Accepte la virgule et les espaces de groupement d'un clavier français. Ne juge pas de
// la validité : le motif s'en charge.
function normaliser(valeur) {
  return String(valeur ?? '')
    .trim()
    .replace(/[\s ]/g, '')
    .replace(',', '.');
}

// PostgreSQL rend un NUMERIC à l'échelle de sa colonne (« 15.000000000000000000 »).
// Repris tel quel en correction, ce texte dépasserait les deux décimales d'un montant.
// Les zéros de fin sont retirés sur la chaîne, sans passer par un flottant.
function sansZerosInutiles(valeur) {
  const texte = String(valeur ?? '');
  if (!texte.includes('.')) {
    return texte;
  }
  return texte.replace(/0+$/, '').replace(/\.$/, '');
}

function estNul(montant) {
  return montant === null || montant === undefined || comparerDecimales(montant, '0') === 0;
}

// Champs du serveur dont l'erreur s'affiche sous le champ du formulaire correspondant.
const CHAMPS_SERVEUR = [
  'sens',
  'quantite',
  'prix_unitaire',
  'frais',
  'frais_montant',
  'frais_unite',
  'frais_contre_valeur_eur',
  'date_transaction',
  'type',
  'symbole',
  'nom',
];

function erreursDuServeur(echec) {
  if (!(echec instanceof ErreurApi) || !Array.isArray(echec.champs)) {
    return null;
  }

  const erreurs = {};
  for (const { champ, message } of echec.champs) {
    if (CHAMPS_SERVEUR.includes(champ)) {
      erreurs[champ] = message;
    }
  }

  return Object.keys(erreurs).length > 0 ? erreurs : null;
}

export default function FeuilleMouvement({
  // Positions déjà valorisées par l'écran d'origine, avec quantité détenue et cours.
  actifs = [],
  actifInitialId = null,
  // Mouvement à corriger : sa présence passe la feuille en édition, et l'actif n'est
  // plus modifiable.
  mouvement = null,
  surFermeture,
  surEnregistrement,
}) {
  const { jeton } = useAuthentification();
  const identifiant = useId();
  const edition = mouvement !== null;

  // Actifs créés depuis la feuille, que l'écran d'origine n'a pas encore rechargés.
  const [ajoutes, setAjoutes] = useState([]);

  const catalogue = useMemo(() => {
    const connus = new Set(actifs.map((position) => String(position.id)));
    return [...actifs, ...ajoutes.filter((position) => !connus.has(String(position.id)))];
  }, [actifs, ajoutes]);

  const idInitial = useMemo(() => {
    const initial = actifs.find((position) => String(position.id) === String(actifInitialId));
    if (initial) {
      return String(initial.id);
    }
    return actifs.length === 1 ? String(actifs[0].id) : '';
  }, [actifs, actifInitialId]);

  // Origine des frais du mouvement corrigé, déduite de son unité plutôt que stockée.
  const origineInitiale = useMemo(() => {
    const unite = mouvement?.frais_unite;
    if (!unite || unite === FRAIS_EN_EUROS) {
      return FRAIS_EN_EUROS;
    }
    const position = actifs.find((element) => String(element.id) === String(actifInitialId));
    return unite === position?.symbole ? FRAIS_EN_ACTIF : FRAIS_EN_TIERS;
  }, [mouvement, actifs, actifInitialId]);

  const [sens, setSens] = useState(() => mouvement?.sens ?? 'achat');
  const [actifId, setActifId] = useState(idInitial);
  const [quantite, setQuantite] = useState(() => sansZerosInutiles(mouvement?.quantite));
  const [prixUnitaire, setPrixUnitaire] = useState(() => {
    if (mouvement) {
      return sansZerosInutiles(mouvement.prix_unitaire);
    }
    return actifs.find((position) => String(position.id) === idInitial)?.cours_eur ?? '';
  });
  // Lu dans le fuseau de l'utilisateur, comme dans la frise des mouvements.
  const jourInitial = mouvement ? jourLocal(new Date(mouvement.date_transaction)) : null;
  const [date, setDate] = useState(() => jourInitial ?? aujourdhui());
  // En édition, le champ reprend le montant prélevé saisi, pas sa contre-valeur.
  const [frais, setFrais] = useState(() => {
    if (!mouvement) {
      return '';
    }
    const montant = mouvement.frais_montant ?? mouvement.frais ?? '0';
    return comparerDecimales(montant, '0') === 0 ? '' : sansZerosInutiles(montant);
  });
  const [origineFrais, setOrigineFrais] = useState(origineInitiale);
  const [symboleFrais, setSymboleFrais] = useState(() =>
    origineInitiale === FRAIS_EN_TIERS ? (mouvement?.frais_unite ?? '') : ''
  );
  const [contreValeurFrais, setContreValeurFrais] = useState(() =>
    origineInitiale === FRAIS_EN_TIERS ? sansZerosInutiles(mouvement?.frais) : ''
  );

  // Sans position existante, la feuille s'ouvre sur la création d'un actif, faute de
  // quoi le premier mouvement serait impossible à saisir.
  const [creation, setCreation] = useState(!edition && actifs.length === 0);
  const [nouvelActif, setNouvelActif] = useState({ type: 'crypto', symbole: '', nom: '' });
  const [creationEnCours, setCreationEnCours] = useState(false);
  // Symboles couverts par classe, demandés seulement à l'ouverture de la création.
  const [couvertures, setCouvertures] = useState(null);

  // Les erreurs locales s'affichent quand le champ est quitté ou à la validation, pas
  // pendant la frappe.
  const [quittes, setQuittes] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [messageServeur, setMessageServeur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const [recapitulatif, setRecapitulatif] = useState(null);
  const [recapitulatifEnCours, setRecapitulatifEnCours] = useState(false);
  const [erreurRecapitulatif, setErreurRecapitulatif] = useState(null);

  const actif = useMemo(
    () => catalogue.find((position) => String(position.id) === String(actifId)) ?? null,
    [catalogue, actifId]
  );

  const quantiteDetenue = actif?.quantite_detenue ?? null;

  useEffect(() => {
    if (!creation || couvertures !== null) {
      return undefined;
    }

    let annule = false;
    api
      .symboles(jeton)
      .then((catalogue) => {
        if (!annule) {
          setCouvertures(catalogue.classes ?? []);
        }
      })
      // Sans catalogue, le symbole reste en saisie libre et le serveur tranche.
      .catch(() => {
        if (!annule) {
          setCouvertures([]);
        }
      });

    return () => {
      annule = true;
    };
  }, [creation, couvertures, jeton]);

  const couvertureChoisie = useMemo(
    () => couvertures?.find((entree) => entree.type === nouvelActif.type) ?? null,
    [couvertures, nouvelActif.type]
  );

  const aideCouverture = useMemo(() => {
    if (!couvertureChoisie) {
      return 'Le code du marché, par exemple BTC, XAU ou USD.';
    }
    // Une liste de symboles n'est vérifiable qu'avec sa source et sa date.
    const date = new Date(couvertureChoisie.constate_le).toLocaleDateString('fr-FR');
    return `${couvertureChoisie.note} Source : ${couvertureChoisie.provenance}, constaté le ${date}.`;
  }, [couvertureChoisie]);

  // Une sortie non marchande (retrait, transfert) n'a ni prix ni montant.
  const sortie = sens === 'sortie_non_marchande';

  // Contrôles de forme alignés sur ceux du serveur.
  const validation = useMemo(() => {
    const trouvees = {};
    const quantiteNormalisee = normaliser(quantite);
    const prixNormalise = normaliser(prixUnitaire);
    const fraisNormalises = normaliser(frais);
    const contreValeurNormalisee = normaliser(contreValeurFrais);
    const enEuros = origineFrais === FRAIS_EN_EUROS;

    if (!actifId) {
      trouvees.actif = "Choisissez l'actif concerné par ce mouvement.";
    }

    if (quantiteNormalisee === '') {
      trouvees.quantite = 'La quantité est obligatoire.';
    } else if (!MOTIF_QUANTITE.test(quantiteNormalisee)) {
      trouvees.quantite = `La quantité doit être un nombre positif, avec au plus ${DECIMALES_QUANTITE} décimales.`;
    } else if (comparerDecimales(quantiteNormalisee, '0') <= 0) {
      trouvees.quantite = 'La quantité doit être supérieure à zéro.';
    }

    if (!sortie) {
      if (prixNormalise === '') {
        trouvees.prix_unitaire = 'Le prix unitaire est obligatoire.';
      } else if (!MOTIF_PRIX.test(prixNormalise)) {
        trouvees.prix_unitaire = `Le prix unitaire doit être un montant positif, avec au plus ${DECIMALES_PRIX} décimales.`;
      }
    }

    // En euros, les frais se comptent au centime ; prélevés dans un actif, ils gardent la
    // précision d'une quantité.
    if (fraisNormalises !== '') {
      const motif = enEuros ? MOTIF_MONTANT : MOTIF_QUANTITE;
      if (!motif.test(fraisNormalises)) {
        trouvees.frais = enEuros
          ? `Les frais doivent être un montant positif ou nul, avec au plus ${DECIMALES_MONTANT} décimales.`
          : `Les frais doivent être une quantité positive ou nulle, avec au plus ${DECIMALES_QUANTITE} décimales.`;
      }
    }

    if (origineFrais === FRAIS_EN_TIERS && fraisNormalises !== '') {
      if (!symboleFrais.trim()) {
        trouvees.frais_unite = "Indiquez l'actif dans lequel les frais ont été prélevés.";
      }
      // Aucun taux ne se déduit du mouvement : le serveur exige la contre-valeur.
      if (contreValeurNormalisee === '') {
        trouvees.frais_contre_valeur_eur =
          'Indiquez la contre-valeur en euros de ces frais au moment de l’opération.';
      } else if (!MOTIF_MONTANT.test(contreValeurNormalisee)) {
        trouvees.frais_contre_valeur_eur = `La contre-valeur doit être un montant positif ou nul, avec au plus ${DECIMALES_MONTANT} décimales.`;
      }
    }

    if (!date) {
      trouvees.date_transaction = 'La date est obligatoire.';
    } else if (date > aujourdhui()) {
      trouvees.date_transaction = "La date ne peut pas être postérieure à aujourd'hui.";
    }

    return trouvees;
  }, [
    actifId,
    quantite,
    prixUnitaire,
    frais,
    origineFrais,
    symboleFrais,
    contreValeurFrais,
    sortie,
    date,
  ]);

  // Annonce avant envoi qu'une sortie dépasse la quantité détenue. La règle appartient
  // au serveur ; l'alerte est immédiate car elle annonce un refus, pas une faute de
  // frappe.
  const depassement = useMemo(() => {
    const quantiteNormalisee = normaliser(quantite);

    // En correction, la quantité détenue inclut déjà le mouvement modifié : seul le
    // récapitulatif du serveur peut juger.
    if (
      edition ||
      sens === 'achat' ||
      quantiteDetenue === null ||
      !MOTIF_QUANTITE.test(quantiteNormalisee) ||
      comparerDecimales(quantiteNormalisee, quantiteDetenue) <= 0
    ) {
      return null;
    }

    const mouvement = sens === 'vente' ? 'une vente' : 'une sortie';
    return `Vous détenez ${formaterQuantite(quantiteDetenue, actif?.type, actif?.symbole)} : ${mouvement} ne peut pas dépasser cette quantité.`;
  }, [edition, sens, quantite, quantiteDetenue, actif]);

  const complet = Object.keys(validation).length === 0 && !depassement;

  // Corps commun à la simulation et à l'enregistrement. Les formes de frais sont
  // exclusives : le serveur refuse un corps qui en porte plusieurs.
  //
  // En correction, l'horodatage d'origine est conservé tant que le jour ne change pas
  // (midi UTC pourrait placer une vente avant l'achat du même jour), et la note est
  // renvoyée, car la correction remplace le mouvement entier.
  const corps = useMemo(() => {
    const montantFrais = normaliser(frais);
    const commun = {
      sens,
      quantite: normaliser(quantite),
      date_transaction:
        edition && date === jourInitial ? mouvement.date_transaction : versHorodatage(date),
    };

    if (edition && typeof mouvement.note === 'string' && mouvement.note.trim() !== '') {
      commun.note = mouvement.note;
    }

    if (sens !== 'sortie_non_marchande') {
      commun.prix_unitaire = normaliser(prixUnitaire);
    }

    if (origineFrais === FRAIS_EN_EUROS) {
      return { ...commun, frais: montantFrais === '' ? '0' : montantFrais };
    }

    if (montantFrais === '') {
      return { ...commun, frais: '0' };
    }

    if (origineFrais === FRAIS_EN_ACTIF) {
      return { ...commun, frais_montant: montantFrais, frais_unite: actif?.symbole ?? '' };
    }

    return {
      ...commun,
      frais_montant: montantFrais,
      frais_unite: symboleFrais.trim().toUpperCase(),
      frais_contre_valeur_eur: normaliser(contreValeurFrais),
    };
  }, [
    sens,
    quantite,
    prixUnitaire,
    frais,
    origineFrais,
    symboleFrais,
    contreValeurFrais,
    actif,
    date,
    edition,
    jourInitial,
    mouvement,
  ]);

  // Le drapeau d'annulation garantit que seule la réponse la plus récente est retenue.
  useEffect(() => {
    if (!complet || !actifId) {
      setRecapitulatif(null);
      setErreurRecapitulatif(null);
      setRecapitulatifEnCours(false);
      return undefined;
    }

    let annule = false;
    setRecapitulatifEnCours(true);

    const minuteur = setTimeout(async () => {
      try {
        const effet = edition
          ? await api.simulerModificationTransaction(jeton, actifId, mouvement.id, corps)
          : await api.simulerTransaction(jeton, actifId, corps);
        if (!annule) {
          setRecapitulatif(effet);
          setErreurRecapitulatif(null);
        }
      } catch (echec) {
        if (!annule) {
          setRecapitulatif(null);
          setErreurRecapitulatif(echec.message);
        }
      } finally {
        if (!annule) {
          setRecapitulatifEnCours(false);
        }
      }
    }, DELAI_RECAPITULATIF);

    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [jeton, actifId, complet, corps, edition, mouvement?.id]);

  // Le prix proposé suit l'actif choisi. Un effet le réappliquerait à chaque
  // rafraîchissement de la liste et écraserait une saisie manuelle.
  function choisirActif(identifiantActif) {
    setActifId(identifiantActif);
    setPrixUnitaire(
      catalogue.find((position) => String(position.id) === String(identifiantActif))?.cours_eur ?? ''
    );
  }

  // Sur une sortie, des frais pris dans l'actif font partie de la quantité retirée : le
  // serveur les refuse.
  function choisirSens(code) {
    setSens(code);
    if (code === 'sortie_non_marchande' && origineFrais === FRAIS_EN_ACTIF) {
      setOrigineFrais(FRAIS_EN_EUROS);
    }
  }

  function marquerQuitte(champ) {
    setQuittes((precedents) => ({ ...precedents, [champ]: true }));
  }

  // L'erreur du serveur prime sur le contrôle local.
  function erreurDe(champ) {
    return erreurs[champ] ?? (quittes[champ] ? validation[champ] : undefined);
  }

  async function ajouterActif() {
    const symbole = nouvelActif.symbole.trim();
    const nom = nouvelActif.nom.trim();

    if (!symbole || !nom) {
      setErreurs({
        symbole: symbole ? undefined : 'Le symbole est obligatoire.',
        nom: nom ? undefined : 'Le nom est obligatoire.',
      });
      return;
    }

    setCreationEnCours(true);
    setErreurs({});
    setMessageServeur(null);

    try {
      // L'actif est créé avant le mouvement pour que la simulation porte sur une
      // position existante, y compris pour un premier achat.
      const cree = await api.creerActif(jeton, { type: nouvelActif.type, symbole, nom });

      // La création ne rend ni cours ni quantité.
      setAjoutes((precedents) => [...precedents, { ...cree, cours_eur: null, quantite_detenue: '0' }]);
      setActifId(String(cree.id));
      setPrixUnitaire('');
      setCreation(false);
      setNouvelActif({ type: 'crypto', symbole: '', nom: '' });
    } catch (echec) {
      const duServeur = erreursDuServeur(echec);
      if (duServeur) {
        setErreurs(duServeur);
      } else if (echec instanceof ErreurApi && echec.statut === 409) {
        // Symbole déjà suivi.
        setErreurs({ symbole: echec.message });
      } else {
        setMessageServeur(echec.message);
      }
    } finally {
      setCreationEnCours(false);
    }
  }

  async function soumettre(evenement) {
    evenement.preventDefault();

    if (!complet) {
      setQuittes({
        quantite: true,
        prix_unitaire: true,
        frais: true,
        frais_unite: true,
        frais_contre_valeur_eur: true,
        date_transaction: true,
      });
      return;
    }

    setEnvoi(true);
    setErreurs({});
    setMessageServeur(null);

    try {
      const enregistre = edition
        ? await api.modifierTransaction(jeton, actifId, mouvement.id, corps)
        : await api.creerTransaction(jeton, actifId, corps);

      // La confirmation reprend la quantité enregistrée par le serveur, pas la saisie.
      const quantiteEnregistree =
        formaterQuantite(enregistre.quantite, actif?.type, actif?.symbole) ?? enregistre.quantite;

      surEnregistrement?.({
        transaction: enregistre,
        actif,
        sens,
        resume: edition
          ? `Mouvement corrigé : ${quantiteEnregistree}.`
          : RESUMES[sens](quantiteEnregistree),
        edition,
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

  const verrouille = envoi || creationEnCours;

  return (
    <Feuille
      titre={edition ? 'Corriger le mouvement' : 'Nouveau mouvement'}
      surFermeture={surFermeture}
      verrouillee={verrouille}
    >
      <form className="mouvement" onSubmit={soumettre} noValidate>
        {/* Boutons radio : options exclusives, parcourues aux flèches du clavier. */}
        <fieldset className="mouvement__sens" disabled={verrouille}>
          <legend className="mouvement__legende">Sens de l'opération</legend>
          <div className="mouvement__bascule">
            {SENS.map((option) => (
              <label
                key={option.code}
                className={`mouvement__choix mouvement__choix--${option.code}${
                  sens === option.code ? ' mouvement__choix--actif' : ''
                }`}
              >
                <input
                  type="radio"
                  name={`${identifiant}-sens`}
                  value={option.code}
                  checked={sens === option.code}
                  onChange={() => choisirSens(option.code)}
                  className="lecteur-ecran-seulement"
                />
                <span>{option.libelle}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {creation ? (
          <fieldset className="mouvement__creation" disabled={verrouille}>
            <legend className="mouvement__legende">Nouvel actif</legend>

            <div className="champ">
              <label className="champ__label" htmlFor={`${identifiant}-classe`}>
                Classe
              </label>
              <select
                id={`${identifiant}-classe`}
                className="champ__saisie"
                value={nouvelActif.type}
                onChange={(evenement) =>
                  // Un symbole d'une autre classe ne doit pas partir au serveur.
                  setNouvelActif({ ...nouvelActif, type: evenement.target.value, symbole: '' })
                }
              >
                {CLASSES_QUANTITE.map((classe) => (
                  <option key={classe} value={classe}>
                    {LIBELLES_CLASSE[classe]}
                  </option>
                ))}
              </select>
            </div>

            {/* Liste fermée si la classe a une liste connue, saisie libre sinon. */}
            {couvertureChoisie?.symboles ? (
              <div className="champ">
                <label className="champ__label" htmlFor={`${identifiant}-symbole`}>
                  Symbole
                  <span className="champ__obligatoire" aria-hidden="true"> *</span>
                  <span className="lecteur-ecran-seulement"> (obligatoire)</span>
                </label>
                <select
                  id={`${identifiant}-symbole`}
                  className={`champ__saisie${erreurs.symbole ? ' champ__saisie--erreur' : ''}`}
                  value={nouvelActif.symbole}
                  onChange={(evenement) =>
                    setNouvelActif({ ...nouvelActif, symbole: evenement.target.value })
                  }
                  aria-describedby={`${identifiant}-symbole-aide`}
                >
                  <option value="">Choisir un symbole</option>
                  {couvertureChoisie.symboles.map((entree) => (
                    <option key={entree.symbole} value={entree.symbole}>
                      {entree.nom ? `${entree.symbole} — ${entree.nom}` : entree.symbole}
                    </option>
                  ))}
                </select>
                <p className="champ__aide" id={`${identifiant}-symbole-aide`}>
                  {aideCouverture}
                </p>
                {erreurs.symbole && <p className="champ__erreur">{erreurs.symbole}</p>}
              </div>
            ) : (
              <Champ
                label="Symbole"
                valeur={nouvelActif.symbole}
                onChange={(evenement) =>
                  setNouvelActif({ ...nouvelActif, symbole: evenement.target.value })
                }
                erreur={erreurs.symbole}
                aide={aideCouverture}
                obligatoire
                maxLength={20}
                autoComplete="off"
              />
            )}

            <Champ
              label="Nom"
              valeur={nouvelActif.nom}
              onChange={(evenement) =>
                setNouvelActif({ ...nouvelActif, nom: evenement.target.value })
              }
              erreur={erreurs.nom}
              obligatoire
              maxLength={100}
              autoComplete="off"
            />

            <div className="mouvement__creation-actions">
              {catalogue.length > 0 && (
                <Bouton variante="secondaire" onClick={() => setCreation(false)}>
                  Revenir à la liste
                </Bouton>
              )}
              <Bouton onClick={ajouterActif} enCours={creationEnCours}>
                Ajouter cet actif
              </Bouton>
            </div>
          </fieldset>
        ) : (
          <div className="champ">
            <label className="champ__label" htmlFor={`${identifiant}-actif`}>
              Actif
              <span className="champ__obligatoire" aria-hidden="true">
                {' '}
                *
              </span>
              <span className="lecteur-ecran-seulement"> (obligatoire)</span>
            </label>
            <select
              id={`${identifiant}-actif`}
              className={`champ__saisie${erreurs.actif ? ' champ__saisie--erreur' : ''}`}
              value={actifId}
              onChange={(evenement) => choisirActif(evenement.target.value)}
              disabled={verrouille || edition}
              aria-invalid={erreurs.actif ? 'true' : undefined}
            >
              <option value="">Choisir un actif</option>
              {catalogue.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.nom} — {position.symbole} ({LIBELLES_CLASSE[position.type]})
                </option>
              ))}
            </select>

            <div className="mouvement__appoint">
              {actif && <JetonClasse classe={actif.type} symbole={actif.symbole} avecLibelle />}
              {!edition && (
                <button
                  type="button"
                  className="mouvement__lien"
                  onClick={() => setCreation(true)}
                  disabled={verrouille}
                >
                  Suivre un nouvel actif
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mouvement__paire">
          <div className="mouvement__quantite">
            <Champ
              label="Quantité"
              valeur={quantite}
              onChange={(evenement) => setQuantite(evenement.target.value)}
              onBlur={() => marquerQuitte('quantite')}
              erreur={depassement ?? erreurDe('quantite')}
              obligatoire
              inputMode="decimal"
              autoComplete="off"
              disabled={verrouille}
            />
            {/* Reprend exactement la quantité rendue par le serveur, sans recopie. */}
            {sens !== 'achat' && quantiteDetenue !== null && !estNul(quantiteDetenue) && (
              <button
                type="button"
                className="mouvement__lien"
                onClick={() => setQuantite(quantiteDetenue)}
                disabled={verrouille}
              >
                {sens === 'vente' ? 'Tout vendre' : 'Tout sortir'}
              </button>
            )}
          </div>

          {!sortie && (
            <Champ
              label="Prix unitaire (€)"
              valeur={prixUnitaire}
              onChange={(evenement) => setPrixUnitaire(evenement.target.value)}
              onBlur={() => marquerQuitte('prix_unitaire')}
              erreur={erreurDe('prix_unitaire')}
              obligatoire
              inputMode="decimal"
              autoComplete="off"
              disabled={verrouille}
            />
          )}
        </div>

        {sortie && (
          <p className="mouvement__aide">
            <span aria-hidden="true">ⓘ </span>
            Une sortie retire la quantité de votre position sans contrepartie en euros :
            transfert vers un autre portefeuille, retrait, ou frais réglés en nature. Elle ne
            dégage aucune plus-value, et la valeur qui quitte le portefeuille est comptée à part.
          </p>
        )}

        {actif && !sortie && (
          <p className="mouvement__aide">
            {actif.cours_eur ? (
              <>
                <span aria-hidden="true">ⓘ </span>
                Cours du jour : <Montant valeur={actif.cours_eur} type="cours" />. Conservez-le pour
                une opération du moment, corrigez-le pour une opération passée.
              </>
            ) : (
              <>
                <span aria-hidden="true">◐ </span>
                Aucun cours n'est disponible pour {actif.symbole} : le prix unitaire n'a pas été
                pré-rempli, saisissez celui de votre opération.
              </>
            )}
          </p>
        )}

        <div className="mouvement__paire">
          <Champ
            label="Date de l'opération"
            type="date"
            valeur={date}
            onChange={(evenement) => setDate(evenement.target.value)}
            onBlur={() => marquerQuitte('date_transaction')}
            erreur={erreurDe('date_transaction')}
            obligatoire
            max={aujourdhui()}
            disabled={verrouille}
          />

          <Champ
            label={origineFrais === FRAIS_EN_EUROS ? 'Frais (€)' : 'Frais prélevés'}
            valeur={frais}
            onChange={(evenement) => setFrais(evenement.target.value)}
            onBlur={() => marquerQuitte('frais')}
            erreur={erreurDe('frais')}
            aide={AIDES_FRAIS[sens]}
            inputMode="decimal"
            autoComplete="off"
            disabled={verrouille}
          />
        </div>

        {/* Unité des frais, demandée seulement une fois un montant saisi. */}
        {normaliser(frais) !== '' && (
          <div className="champ">
            <label className="champ__label" htmlFor={`${identifiant}-origine-frais`}>
              Ces frais ont été prélevés en
            </label>
            <select
              id={`${identifiant}-origine-frais`}
              className="champ__saisie"
              value={origineFrais}
              onChange={(evenement) => setOrigineFrais(evenement.target.value)}
              disabled={verrouille}
            >
              <option value={FRAIS_EN_EUROS}>euros</option>
              {!sortie && actif && (
                <option value={FRAIS_EN_ACTIF}>{actif.symbole}, l’actif de l’opération</option>
              )}
              <option value={FRAIS_EN_TIERS}>un autre actif</option>
            </select>
            {origineFrais === FRAIS_EN_ACTIF && actif && (
              <p className="champ__aide">
                Saisissez la quantité <strong>reçue</strong> et les frais retenus par la
                plateforme : ils sont convertis au prix de l’opération.
              </p>
            )}
          </div>
        )}

        {normaliser(frais) !== '' && origineFrais === FRAIS_EN_TIERS && (
          <div className="mouvement__paire">
            <Champ
              label="Actif des frais"
              valeur={symboleFrais}
              onChange={(evenement) => setSymboleFrais(evenement.target.value)}
              onBlur={() => marquerQuitte('frais_unite')}
              erreur={erreurDe('frais_unite')}
              aide="Le code du marché, par exemple BNB."
              maxLength={20}
              autoComplete="off"
              disabled={verrouille}
            />
            <Champ
              label="Contre-valeur en euros"
              valeur={contreValeurFrais}
              onChange={(evenement) => setContreValeurFrais(evenement.target.value)}
              onBlur={() => marquerQuitte('frais_contre_valeur_eur')}
              erreur={erreurDe('frais_contre_valeur_eur')}
              aide="Ce que valaient ces frais en euros au moment de l’opération."
              inputMode="decimal"
              autoComplete="off"
              disabled={verrouille}
            />
          </div>
        )}

        {/* Région vivante : les recalculs sont annoncés sans interrompre la saisie. */}
        <section
          className="mouvement__recapitulatif"
          aria-live="polite"
          aria-busy={recapitulatifEnCours || undefined}
          aria-labelledby={`${identifiant}-recapitulatif`}
        >
          <h3 id={`${identifiant}-recapitulatif`} className="mouvement__intitule">
            Effet de ce mouvement
          </h3>

          {erreurRecapitulatif ? (
            <p className="mouvement__recapitulatif-absent">
              L'effet de ce mouvement ne peut pas être calculé : {erreurRecapitulatif}
            </p>
          ) : recapitulatif ? (
            <dl className="mouvement__effet">
              {!sortie && (
                <div>
                  <dt>Montant de l'opération</dt>
                  <dd>
                    <Montant valeur={recapitulatif.montant} />
                  </dd>
                </div>
              )}

              {!estNul(recapitulatif.frais) && (
                <div>
                  <dt>Frais</dt>
                  <dd>
                    <Montant valeur={recapitulatif.frais} />
                    {recapitulatif.frais_unite && recapitulatif.frais_unite !== FRAIS_EN_EUROS && (
                      <span className="mouvement__inchange">
                        {formaterQuantiteEnNature(
                          recapitulatif.frais_montant,
                          recapitulatif.frais_unite
                        )}
                      </span>
                    )}
                  </dd>
                </div>
              )}

              {recapitulatif.cout_sortie != null && (
                <div>
                  <dt>Valeur sortie du portefeuille</dt>
                  <dd>
                    <Montant valeur={recapitulatif.cout_sortie} />
                  </dd>
                </div>
              )}

              <div>
                <dt>Quantité détenue après</dt>
                <dd>
                  <Montant
                    valeur={recapitulatif.quantite_detenue_apres}
                    type="quantite"
                    classe={actif?.type}
                    symbole={actif?.symbole}
                  />
                </dd>
              </div>

              {recapitulatif.plus_value_realisee !== null && (
                <div>
                  <dt>Plus-value réalisée</dt>
                  <dd>
                    <Variation valeur={recapitulatif.plus_value_realisee} mode="absolue" />
                  </dd>
                </div>
              )}

              <div className="mouvement__effet-total">
                <dt>Nouveau prix de revient</dt>
                <dd>
                  <Montant valeur={recapitulatif.pru_apres} type="cours" />
                  {/* Une vente ne déplace pas le prix de revient. */}
                  {estNul(recapitulatif.effet_pru) ? (
                    <span className="mouvement__inchange">inchangé</span>
                  ) : (
                    <Variation valeur={recapitulatif.effet_pru} mode="absolue" />
                  )}
                </dd>
              </div>
            </dl>
          ) : recapitulatifEnCours ? (
            <p className="mouvement__recapitulatif-absent">Calcul en cours…</p>
          ) : (
            <p className="mouvement__recapitulatif-absent">
              Choisissez un actif, une quantité et un prix unitaire pour voir l'effet de ce
              mouvement sur votre position.
            </p>
          )}
        </section>

        {messageServeur && <Message variante="erreur">{messageServeur}</Message>}

        <div className="feuille__actions">
          <Bouton variante="secondaire" onClick={surFermeture} desactive={verrouille}>
            Annuler
          </Bouton>
          {/* Pas d'enregistrement tant que le serveur n'a pas rendu l'effet du mouvement. */}
          <Bouton type="submit" enCours={envoi} desactive={!recapitulatif || verrouille}>
            {edition ? 'Enregistrer la correction' : 'Enregistrer'}
          </Bouton>
        </div>
      </form>
    </Feuille>
  );
}
