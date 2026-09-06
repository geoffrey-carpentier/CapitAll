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

// Saisie d'un mouvement, achat ou vente.
//
// C'est l'écran où se crée la donnée, et le seul de l'application dont le contenu ne
// soit pas qu'une restitution. Deux principes le gouvernent.
//
// Le premier est que l'utilisateur voit l'effet de sa saisie avant de valider : le
// récapitulatif annonce le montant de l'opération, la quantité qu'il détiendra ensuite,
// le nouveau prix de revient et son déplacement, et pour une vente la plus-value
// dégagée. C'est ce qui distingue un outil de suivi de patrimoine d'un formulaire.
//
// Le second est que ce récapitulatif n'est pas calculé ici. Le prix de revient est une
// moyenne pondérée sur toute l'histoire de la position, et une seconde implémentation de
// cette règle finirait par diverger de celle du moteur (D69). L'interface interroge donc
// le serveur, qui rejoue le déroulé sans rien écrire, et affiche ce qu'il rend. Les
// seules opérations faites ici sont des contrôles de forme sur les champs et des
// comparaisons de quantités, toutes exactes et sans conversion en flottant.
//
// La saisie est en euros, devise de référence des calculs et du stockage (D11). La
// bascule euro-dollar des écrans de restitution ne s'applique pas ici : elle ne change
// que l'affichage, alors qu'un montant saisi est celui qui sera enregistré.

const SENS = [
  { code: 'achat', libelle: 'Achat' },
  { code: 'vente', libelle: 'Vente' },
  { code: 'sortie_non_marchande', libelle: 'Sortie' },
];

// Précisions admises par les colonnes NUMERIC du schéma : dix-huit décimales pour une
// quantité comme pour un prix depuis D88, deux pour un montant en euros. Ces contrôles
// reprennent ceux des schémas Zod du serveur, qui reste seul décisionnaire.
//
// Les deux premiers plafonnaient encore à huit et deux décimales, ce qui refusait à la
// saisie les valeurs mêmes que le contrat numérique venait rendre possibles : un cours
// de 0,0000123 euro était rejeté par le formulaire avant d'atteindre le serveur, qui
// l'accepte.
const DECIMALES_QUANTITE = 18;
const DECIMALES_PRIX = 18;
const DECIMALES_MONTANT = 2;

const MOTIF_QUANTITE = new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_QUANTITE}})?$`);
const MOTIF_PRIX = new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_PRIX}})?$`);
const MOTIF_MONTANT = new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_MONTANT}})?$`);

// Unité de prélèvement des frais. L'euro est le cas courant ; l'actif échangé est celui
// des plateformes de cryptomonnaies, qui retiennent leur part dans ce qu'elles vendent ;
// le tiers actif est le cas où aucun taux ne se lit dans le mouvement, et où la
// contre-valeur doit donc être demandée.
const FRAIS_EN_EUROS = 'EUR';
const FRAIS_EN_ACTIF = 'actif';
const FRAIS_EN_TIERS = 'tiers';

// Confirmation remise à l'écran d'origine. Le mot compte : « vente » sur un transfert
// est précisément ce que D89 corrige, et une confirmation est ce que l'utilisateur
// relit le lendemain pour se rappeler ce qu'il a saisi.
const RESUMES = {
  achat: (quantite) => `Achat de ${quantite} enregistré.`,
  vente: (quantite) => `Vente de ${quantite} enregistrée.`,
  sortie_non_marchande: (quantite) => `Sortie de ${quantite} enregistrée.`,
};

// Délai d'inactivité avant de demander le récapitulatif. Assez court pour que le chiffre
// suive la frappe, assez long pour ne pas envoyer une requête par caractère.
const DELAI_RECAPITULATIF = 350;

// Date du jour dans le fuseau de l'utilisateur, au format attendu par un champ de date.
// L'heure UTC ne conviendrait pas : passé minuit, elle désignerait encore la veille.
function aujourdhui() {
  const maintenant = new Date();
  const decalage = maintenant.getTimezoneOffset() * 60000;
  return new Date(maintenant.getTime() - decalage).toISOString().slice(0, 10);
}

// Un champ de date rend un jour, la colonne attend un instant.
//
// Le jour courant part avec l'heure courante : l'opération a lieu maintenant. Un jour
// passé part à midi UTC, et non à minuit, pour que la date relue reste la même quel que
// soit le fuseau d'affichage. Minuit UTC se relit la veille dès qu'on est à l'ouest de
// Greenwich, ce qui décalerait la frise des mouvements d'un jour.
function versHorodatage(jour) {
  return jour === aujourdhui() ? new Date().toISOString() : `${jour}T12:00:00.000Z`;
}

// Une saisie décimale peut arriver avec une virgule, des espaces de groupement, ou les
// deux : c'est ce que produit un clavier français. La normalisation ne juge pas de la
// validité, elle rend une chaîne comparable au motif.
function normaliser(valeur) {
  return String(valeur ?? '')
    .trim()
    .replace(/[\s ]/g, '')
    .replace(',', '.');
}

function estNul(montant) {
  return montant === null || montant === undefined || comparerDecimales(montant, '0') === 0;
}

// Correspondance entre les champs du serveur et ceux du formulaire. Les noms coïncident,
// mais la table est explicite : une erreur de validation doit se poser sur le champ
// concerné, jamais dans un bloc en marge du formulaire.
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
  // Positions déjà valorisées par le serveur, telles que l'écran d'origine les a
  // reçues : aucune requête n'est refaite pour la liste, et la quantité détenue comme
  // le cours du jour arrivent avec elles.
  actifs = [],
  actifInitialId = null,
  // Mouvement à corriger, le cas échéant (D51 révisée). Sa présence fait basculer la
  // feuille en édition : les champs partent de ses valeurs, l'actif n'est plus
  // sélectionnable — un mouvement ne se déplace pas d'une position à une autre — et la
  // validation corrige au lieu de créer.
  mouvement = null,
  surFermeture,
  surEnregistrement,
}) {
  const { jeton } = useAuthentification();
  const identifiant = useId();
  const edition = mouvement !== null;

  // Actifs créés depuis la feuille, tant que l'écran d'origine n'a pas rechargé sa
  // liste. Sans eux, l'actif que l'on vient d'ajouter disparaîtrait du sélecteur.
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

  // Origine des frais du mouvement corrigé, déduite de son unité : elle vaut l'euro,
  // le symbole de sa position, ou un tiers actif. La déduire ici évite de stocker en
  // base une information que l'unité porte déjà.
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
  const [quantite, setQuantite] = useState(() => mouvement?.quantite ?? '');
  const [prixUnitaire, setPrixUnitaire] = useState(() => {
    if (mouvement) {
      return mouvement.prix_unitaire ?? '';
    }
    return actifs.find((position) => String(position.id) === idInitial)?.cours_eur ?? '';
  });
  const [date, setDate] = useState(() =>
    mouvement ? new Date(mouvement.date_transaction).toISOString().slice(0, 10) : aujourdhui()
  );
  // En édition, le champ porte le montant réellement prélevé, pas sa contre-valeur :
  // c'est ce que l'utilisateur avait saisi, et c'est donc ce qu'il doit relire.
  const [frais, setFrais] = useState(() => {
    if (!mouvement) {
      return '';
    }
    const montant = mouvement.frais_montant ?? mouvement.frais ?? '0';
    return comparerDecimales(montant, '0') === 0 ? '' : montant;
  });
  const [origineFrais, setOrigineFrais] = useState(origineInitiale);
  const [symboleFrais, setSymboleFrais] = useState(() =>
    origineInitiale === FRAIS_EN_TIERS ? (mouvement?.frais_unite ?? '') : ''
  );
  const [contreValeurFrais, setContreValeurFrais] = useState(() =>
    origineInitiale === FRAIS_EN_TIERS ? (mouvement?.frais ?? '') : ''
  );

  // Un portefeuille vide n'a rien à sélectionner : la feuille s'ouvre alors directement
  // sur la création, sans quoi le tout premier mouvement serait impossible à saisir.
  // Une correction porte sur une position qui existe : la question ne s'y pose pas.
  const [creation, setCreation] = useState(!edition && actifs.length === 0);
  const [nouvelActif, setNouvelActif] = useState({ type: 'crypto', symbole: '', nom: '' });
  const [creationEnCours, setCreationEnCours] = useState(false);
  // Couverture des symboles par classe, telle que le serveur la déclare (D27). Elle
  // n'est demandée qu'à l'ouverture du panneau de création : la grande majorité des
  // saisies porte sur une position déjà suivie et n'en a aucun besoin.
  const [couvertures, setCouvertures] = useState(null);

  // Un message d'erreur n'apparaît pas pendant qu'on remplit un champ, mais lorsqu'on
  // le quitte, ou à la validation : signaler « 0, n'est pas un nombre » à la deuxième
  // frappe ferait clignoter le formulaire sans rien apprendre.
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
      // Le catalogue est un confort, pas une condition : s'il n'arrive pas, le champ
      // reste une saisie libre et le serveur reste seul juge, comme avant.
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
    // La provenance et la date accompagnent la liste : une liste sans date est une liste
    // dont personne ne peut dire si elle est encore vraie.
    const date = new Date(couvertureChoisie.constate_le).toLocaleDateString('fr-FR');
    return `${couvertureChoisie.note} Source : ${couvertureChoisie.provenance}, constaté le ${date}.`;
  }, [couvertureChoisie]);

  // Une sortie non marchande — retrait, transfert — ne dégage aucun produit : elle n'a
  // ni prix ni montant, et le formulaire ne les demande donc pas (D89).
  const sortie = sens === 'sortie_non_marchande';

  // Contrôles de forme, repris de ceux du serveur. Les messages nomment le champ et la
  // règle : un code d'erreur n'apprendrait rien à qui saisit.
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

    // Les frais réglés en euros se comptent au centime ; prélevés dans un actif, ils
    // sont une quantité et en gardent la précision.
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
      // Aucun taux ne se lit dans le mouvement : le serveur refusera de le deviner, et
      // l'annoncer ici évite un aller-retour pour une information que l'utilisateur a
      // sous les yeux.
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

  // Bornage de la vente à la quantité réellement détenue.
  //
  // La règle appartient au serveur, qui refuse la transaction et dont le message fait
  // foi : l'interface se contente de l'annoncer avant l'envoi, à partir de la quantité
  // qu'il a lui-même rendue. Elle est signalée sans attendre que le champ soit quitté,
  // parce qu'elle annonce un refus et non une faute de frappe.
  const depassement = useMemo(() => {
    const quantiteNormalisee = normaliser(quantite);

    // En correction, la quantité détenue comprend déjà le mouvement que l'on modifie :
    // la comparer à la nouvelle valeur refuserait à tort une vente qu'on augmente
    // légitimement. Le seul juge est alors le récapitulatif du serveur, qui rejoue toute
    // l'histoire de la position avec le mouvement remplacé — et il tourne à chaque
    // frappe.
    if (
      edition ||
      sens === 'achat' ||
      quantiteDetenue === null ||
      !MOTIF_QUANTITE.test(quantiteNormalisee) ||
      comparerDecimales(quantiteNormalisee, quantiteDetenue) <= 0
    ) {
      return null;
    }

    // La règle vaut pour toute sortie de quantité, vente ou non : elle ne dépend pas de
    // ce que le mouvement rapporte.
    const mouvement = sens === 'vente' ? 'une vente' : 'une sortie';
    return `Vous détenez ${formaterQuantite(quantiteDetenue, actif?.type, actif?.symbole)} : ${mouvement} ne peut pas dépasser cette quantité.`;
  }, [edition, sens, quantite, quantiteDetenue, actif]);

  const complet = Object.keys(validation).length === 0 && !depassement;

  // Corps envoyé au serveur, identique pour la simulation et pour l'enregistrement : les
  // deux routes partagent le même schéma de validation.
  // Les trois formes de frais du serveur sont mutuellement exclusives : le corps en
  // porte une seule, celle que l'utilisateur a choisie. Envoyer la forme courte et la
  // forme longue ensemble obligerait le serveur à décider laquelle prime, et il refuse
  // — à raison — de le faire.
  const corps = useMemo(() => {
    const montantFrais = normaliser(frais);
    const commun = {
      sens,
      quantite: normaliser(quantite),
      date_transaction: versHorodatage(date),
    };

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
  ]);

  // Récapitulatif recalculé à chaque modification, après un court délai d'inactivité.
  //
  // Seule la réponse la plus récente est retenue : sans le drapeau d'annulation, une
  // requête partie plus tôt et revenue plus tard écraserait un récapitulatif plus juste.
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

  // Changer d'actif change de cours : la proposition de prix suit la sélection. Elle
  // n'est pas posée par un effet, qui la réappliquerait à chaque rafraîchissement de la
  // liste et effacerait une valeur saisie à la main.
  function choisirActif(identifiantActif) {
    setActifId(identifiantActif);
    setPrixUnitaire(
      catalogue.find((position) => String(position.id) === String(identifiantActif))?.cours_eur ?? ''
    );
  }

  // Des frais prélevés dans l'actif qui sort font déjà partie de la quantité retirée :
  // le serveur les refuse, et l'option disparaît plutôt que de mener à un refus.
  function choisirSens(code) {
    setSens(code);
    if (code === 'sortie_non_marchande' && origineFrais === FRAIS_EN_ACTIF) {
      setOrigineFrais(FRAIS_EN_EUROS);
    }
  }

  function marquerQuitte(champ) {
    setQuittes((precedents) => ({ ...precedents, [champ]: true }));
  }

  // Erreur affichée sous un champ : celle du serveur d'abord, puis le contrôle local
  // une fois le champ quitté ou la validation tentée.
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
      // L'actif est créé avant la saisie du mouvement, et non avec lui : le
      // récapitulatif interroge le serveur sur une position qui existe, et la règle
      // « pas de validation sans récapitulatif » vaut alors aussi pour un premier achat.
      const cree = await api.creerActif(jeton, { type: nouvelActif.type, symbole, nom });

      // La création rend la ligne de la table, sans cours ni quantité : la position
      // n'existe pas encore. Les deux champs sont posés explicitement pour que le reste
      // de la feuille les lise comme « aucun cours » et « rien de détenu ».
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
        // Le symbole est déjà suivi : l'information appartient au champ qui le porte.
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

      // La confirmation est rédigée ici, où le sens, la classe et le symbole sont
      // connus, et remise à l'écran d'origine qui l'affichera après le rafraîchissement.
      // La quantité reprise est celle que le serveur a enregistrée, pas celle qui a été
      // saisie : ce sont les mêmes, et c'est justement ce que la confirmation atteste.
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
        // Règle de gestion refusée ou incident : le message du serveur part tel quel,
        // sans être reformulé ni remplacé par un code.
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
        {/* Le sens est un groupe de boutons radio et non une paire de boutons : les deux
            options sont exclusives, et les flèches du clavier doivent passer de l'une à
            l'autre sans quitter le groupe. */}
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
                  // Le symbole est vidé avec le changement de classe : AAPL n'a rien à
                  // faire dans une liste de métaux, et une valeur restée en place
                  // partirait au serveur.
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

            {/* Le champ suit la couverture de la classe (D27, S-16). Une classe dont
                l'application connaît la liste propose un choix : l'utilisateur ne
                découvre plus le refus après avoir tapé. Une classe dont seul le
                fournisseur sait garde une saisie libre, et annonce d'où viendra la
                réponse. */}
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
              {/* Un mouvement ne se déplace pas d'une position à une autre : en
                  correction, ni le choix de l'actif ni l'ouverture d'une nouvelle
                  position n'ont de sens. */}
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
            {/* Raccourci de vente totale : il évite de recopier à la main une quantité à
                huit décimales, et garantit que la valeur envoyée est exactement celle que
                le serveur a rendue. */}
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

        {/* Le cours du jour est une proposition et non une contrainte : le dire évite de
            laisser croire que la valeur affichée est celle de l'opération passée que l'on
            est en train de saisir. */}
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
            aide="Facultatif. Les frais d'achat entrent dans le prix de revient."
            inputMode="decimal"
            autoComplete="off"
            disabled={verrouille}
          />
        </div>

        {/* Unité réellement prélevée. Elle n'apparaît qu'une fois un montant saisi :
            un champ de plus sur un formulaire où neuf mouvements sur dix n'ont pas de
            frais en nature pèserait plus qu'il ne servirait. */}
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
              {/* Retirés de la position elle-même, ils font partie de la quantité qui
                  sort : l'option n'a pas de sens sur une sortie. */}
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

        {/* Le récapitulatif est une région vivante : ses recalculs sont annoncés sans
            interrompre la saisie en cours. */}
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
                    {/* La conversion est annoncée avant validation, jamais découverte
                        après : c'est le seul moment où l'utilisateur peut corriger un
                        prix d'opération dont dépend la contre-valeur. */}
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
                  {/* Une vente ne déplace pas le prix de revient : le dire vaut mieux
                      qu'afficher « +0,00 », que l'utilisateur aurait à interpréter. */}
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
          {/* La validation reste bloquée tant que l'effet du mouvement n'a pas pu être
              calculé : enregistrer sans l'avoir vu retirerait à cet écran sa raison
              d'être, et signifierait que le serveur n'a pas accepté la saisie. */}
          <Bouton type="submit" enCours={envoi} desactive={!recapitulatif || verrouille}>
            {edition ? 'Enregistrer la correction' : 'Enregistrer'}
          </Bouton>
        </div>
      </form>
    </Feuille>
  );
}
