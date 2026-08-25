import { useEffect, useId, useMemo, useState } from 'react';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { api, ErreurApi } from '../services/api';
import { comparerDecimales, formaterQuantite, CLASSES_QUANTITE } from '../utils/formatage';
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
];

// Précisions admises par les colonnes NUMERIC du schéma : 8 décimales pour une
// quantité, 2 pour un montant. Ces contrôles reprennent ceux des schémas Zod du
// serveur, qui reste seul décisionnaire.
const MOTIF_QUANTITE = /^\d+(\.\d{1,8})?$/;
const MOTIF_MONTANT = /^\d+(\.\d{1,2})?$/;

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
  surFermeture,
  surEnregistrement,
}) {
  const { jeton } = useAuthentification();
  const identifiant = useId();

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

  const [sens, setSens] = useState('achat');
  const [actifId, setActifId] = useState(idInitial);
  const [quantite, setQuantite] = useState('');
  const [prixUnitaire, setPrixUnitaire] = useState(
    () => actifs.find((position) => String(position.id) === idInitial)?.cours_eur ?? ''
  );
  const [date, setDate] = useState(aujourdhui);
  const [frais, setFrais] = useState('');

  // Un portefeuille vide n'a rien à sélectionner : la feuille s'ouvre alors directement
  // sur la création, sans quoi le tout premier mouvement serait impossible à saisir.
  const [creation, setCreation] = useState(actifs.length === 0);
  const [nouvelActif, setNouvelActif] = useState({ type: 'crypto', symbole: '', nom: '' });
  const [creationEnCours, setCreationEnCours] = useState(false);

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

  // Contrôles de forme, repris de ceux du serveur. Les messages nomment le champ et la
  // règle : un code d'erreur n'apprendrait rien à qui saisit.
  const validation = useMemo(() => {
    const trouvees = {};
    const quantiteNormalisee = normaliser(quantite);
    const prixNormalise = normaliser(prixUnitaire);
    const fraisNormalises = normaliser(frais);

    if (!actifId) {
      trouvees.actif = "Choisissez l'actif concerné par ce mouvement.";
    }

    if (quantiteNormalisee === '') {
      trouvees.quantite = 'La quantité est obligatoire.';
    } else if (!MOTIF_QUANTITE.test(quantiteNormalisee)) {
      trouvees.quantite = 'La quantité doit être un nombre positif, avec au plus 8 décimales.';
    } else if (comparerDecimales(quantiteNormalisee, '0') <= 0) {
      trouvees.quantite = 'La quantité doit être supérieure à zéro.';
    }

    if (prixNormalise === '') {
      trouvees.prix_unitaire = 'Le prix unitaire est obligatoire.';
    } else if (!MOTIF_MONTANT.test(prixNormalise)) {
      trouvees.prix_unitaire =
        'Le prix unitaire doit être un montant positif, avec au plus 2 décimales.';
    }

    if (fraisNormalises !== '' && !MOTIF_MONTANT.test(fraisNormalises)) {
      trouvees.frais = 'Les frais doivent être un montant positif ou nul, avec au plus 2 décimales.';
    }

    if (!date) {
      trouvees.date_transaction = 'La date est obligatoire.';
    } else if (date > aujourdhui()) {
      trouvees.date_transaction = "La date ne peut pas être postérieure à aujourd'hui.";
    }

    return trouvees;
  }, [actifId, quantite, prixUnitaire, frais, date]);

  // Bornage de la vente à la quantité réellement détenue.
  //
  // La règle appartient au serveur, qui refuse la transaction et dont le message fait
  // foi : l'interface se contente de l'annoncer avant l'envoi, à partir de la quantité
  // qu'il a lui-même rendue. Elle est signalée sans attendre que le champ soit quitté,
  // parce qu'elle annonce un refus et non une faute de frappe.
  const depassement = useMemo(() => {
    const quantiteNormalisee = normaliser(quantite);

    if (
      sens !== 'vente' ||
      quantiteDetenue === null ||
      !MOTIF_QUANTITE.test(quantiteNormalisee) ||
      comparerDecimales(quantiteNormalisee, quantiteDetenue) <= 0
    ) {
      return null;
    }

    return `Vous détenez ${formaterQuantite(quantiteDetenue, actif?.type, actif?.symbole)} : une vente ne peut pas dépasser cette quantité.`;
  }, [sens, quantite, quantiteDetenue, actif]);

  const complet = Object.keys(validation).length === 0 && !depassement;

  // Corps envoyé au serveur, identique pour la simulation et pour l'enregistrement : les
  // deux routes partagent le même schéma de validation.
  const corps = useMemo(
    () => ({
      sens,
      quantite: normaliser(quantite),
      prix_unitaire: normaliser(prixUnitaire),
      frais: normaliser(frais) === '' ? '0' : normaliser(frais),
      date_transaction: versHorodatage(date),
    }),
    [sens, quantite, prixUnitaire, frais, date]
  );

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
        const effet = await api.simulerTransaction(jeton, actifId, corps);
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
  }, [jeton, actifId, complet, corps]);

  // Changer d'actif change de cours : la proposition de prix suit la sélection. Elle
  // n'est pas posée par un effet, qui la réappliquerait à chaque rafraîchissement de la
  // liste et effacerait une valeur saisie à la main.
  function choisirActif(identifiantActif) {
    setActifId(identifiantActif);
    setPrixUnitaire(
      catalogue.find((position) => String(position.id) === String(identifiantActif))?.cours_eur ?? ''
    );
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
        date_transaction: true,
      });
      return;
    }

    setEnvoi(true);
    setErreurs({});
    setMessageServeur(null);

    try {
      const enregistre = await api.creerTransaction(jeton, actifId, corps);

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
        resume:
          sens === 'achat'
            ? `Achat de ${quantiteEnregistree} enregistré.`
            : `Vente de ${quantiteEnregistree} enregistrée.`,
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
    <Feuille titre="Nouveau mouvement" surFermeture={surFermeture} verrouillee={verrouille}>
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
                  onChange={() => setSens(option.code)}
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
                  setNouvelActif({ ...nouvelActif, type: evenement.target.value })
                }
              >
                {CLASSES_QUANTITE.map((classe) => (
                  <option key={classe} value={classe}>
                    {LIBELLES_CLASSE[classe]}
                  </option>
                ))}
              </select>
            </div>

            <Champ
              label="Symbole"
              valeur={nouvelActif.symbole}
              onChange={(evenement) =>
                setNouvelActif({ ...nouvelActif, symbole: evenement.target.value })
              }
              erreur={erreurs.symbole}
              aide="Le code du marché, par exemple BTC, XAU ou USD."
              obligatoire
              maxLength={20}
              autoComplete="off"
            />

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
              disabled={verrouille}
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
              {actif && <JetonClasse classe={actif.type} avecLibelle />}
              <button
                type="button"
                className="mouvement__lien"
                onClick={() => setCreation(true)}
                disabled={verrouille}
              >
                Suivre un nouvel actif
              </button>
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
            {sens === 'vente' && quantiteDetenue !== null && !estNul(quantiteDetenue) && (
              <button
                type="button"
                className="mouvement__lien"
                onClick={() => setQuantite(quantiteDetenue)}
                disabled={verrouille}
              >
                Tout vendre
              </button>
            )}
          </div>

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
        </div>

        {/* Le cours du jour est une proposition et non une contrainte : le dire évite de
            laisser croire que la valeur affichée est celle de l'opération passée que l'on
            est en train de saisir. */}
        {actif && (
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
            label="Frais (€)"
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
              <div>
                <dt>Montant de l'opération</dt>
                <dd>
                  <Montant valeur={recapitulatif.montant} />
                </dd>
              </div>

              {!estNul(recapitulatif.frais) && (
                <div>
                  <dt>Frais</dt>
                  <dd>
                    <Montant valeur={recapitulatif.frais} />
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
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Feuille>
  );
}
