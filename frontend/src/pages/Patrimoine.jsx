import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { useMouvement } from '../hooks/useMouvement';
import { api, ErreurApi } from '../services/api';
import { convertir } from '../utils/conversion';
import { sensVariation } from '../utils/formatage';
import { formaterInstant } from '../utils/duree';
import { fenetreDePeriode } from '../utils/serie';
import Bouton from '../composants/Bouton';
import Carte from '../composants/Carte';
import FeuilleMouvement from '../composants/FeuilleMouvement';
import Montant from '../composants/Montant';
import Variation from '../composants/Variation';
import SelecteurPeriode from '../composants/SelecteurPeriode';
import BasculeDevise from '../composants/BasculeDevise';
import MasquageMontants from '../composants/MasquageMontants';
import EtatVide from '../composants/EtatVide';
import Squelette from '../composants/Squelette';
import MessageErreur from '../composants/MessageErreur';
import Repartition from '../composants/Repartition';
import Message from '../composants/Message';
import {
  lirePreference,
  ecrirePreference,
  CLE_DEVISE,
  CLE_MASQUAGE,
} from '../utils/preferences';
import './Patrimoine.css';

// La courbe est chargée à la demande. Elle apporte la bibliothèque de tracé, qui pèse
// plus lourd que tout le reste de l'application réunie : la charger d'emblée retarderait
// l'affichage du patrimoine, seule information réellement attendue à l'ouverture, et
// cela sur l'écran d'arrivée d'une interface pensée pour le mobile. Le squelette occupe
// sa place pendant le chargement, comme pour les données.
//
// La répartition, elle, est une liste : elle n'a plus rien à charger depuis que l'anneau
// a été retiré (D74), et se rend directement.
const Courbe = lazy(() => import('../composants/Courbe'));

// Écran Patrimoine.
//
// Il répond à quatre questions dans cet ordre : combien je possède, comment cela a
// évolué, comment c'est réparti, qu'est-ce qui demande mon attention. La composition
// suit cet ordre et l'assume : le patrimoine domine, les chiffres de contexte sont des
// lignes de texte et non des cartes, parce que ce sont des repères et non des
// indicateurs de tête.
//
// Aucune valeur n'est mise en forme ici : tout passe par le composant Montant, donc par
// le module de formatage. La seule opération numérique de l'écran est l'application du
// taux d'affichage, en arithmétique exacte, sans requête supplémentaire.

// Nombre de jours retenus pour chaque plage. Le découpage se fait à l'affichage, sur la
// série entière déjà reçue : changer de plage ne demande plus rien au serveur.
const JOURS_PAR_PERIODE = { jour: 1, semaine: 7, mois: 30, annee: 365, origine: null };

// Période par défaut : le mois, plus proche du rythme réel de consultation. L'année
// reste à un clic.
const PERIODE_PAR_DEFAUT = 'mois';

function natureDeLErreur(erreur) {
  if (!(erreur instanceof ErreurApi)) {
    return 'api';
  }
  // Le client d'API rend un statut 0 lorsque la requête n'a reçu aucune réponse.
  if (erreur.statut === 0) {
    return 'reseau';
  }
  return erreur.statut === 401 ? 'session' : 'api';
}

export default function Patrimoine() {
  const { jeton, utilisateur } = useAuthentification();
  const naviguer = useNavigate();
  const emplacement = useLocation();

  const [portefeuille, setPortefeuille] = useState(null);
  const [historique, setHistorique] = useState(null);
  const [periode, setPeriode] = useState(PERIODE_PAR_DEFAUT);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [confirmation, setConfirmation] = useState(null);

  const mouvement = useMouvement();

  const [devise, setDevise] = useState(() => lirePreference(CLE_DEVISE, 'EUR'));
  const [masque, setMasque] = useState(() => lirePreference(CLE_MASQUAGE, 'non') === 'oui');

  // L'arrivée depuis l'inscription est signalée par la navigation : c'est ce qui
  // distingue un premier lancement d'un portefeuille devenu vide.
  const premierLancement = emplacement.state?.premierLancement === true;

  // Actualisation du tableau de bord : elle relève le point du jour et évalue les seuils
  // (D49, D50). C'est une commande explicite, et le seul appel de l'application qui
  // écrive quelque chose en consultant.
  //
  // Elle ne dépend pas de la période : la série arrive entière et le sélecteur ne fait
  // qu'en découper une fenêtre. Auparavant, chaque changement de plage rechargeait le
  // portefeuille complet, donc rappelait les fournisseurs de cours et réécrivait tout.
  const actualiser = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    try {
      const [donnees, serie] = await Promise.all([
        api.actualiserPortefeuille(jeton),
        api.historique(jeton),
      ]);
      setPortefeuille(donnees);
      setHistorique(serie);
    } catch (echec) {
      setErreur(echec);
    } finally {
      setChargement(false);
    }
  }, [jeton]);

  useEffect(() => {
    actualiser();
  }, [actualiser]);

  const taux = portefeuille?.taux_affichage?.eur_vers_usd ?? null;

  // Conversion à l'affichage seulement : les montants restent en euros dans les données.
  const afficher = useCallback(
    (montantEnEuros) => {
      if (montantEnEuros === null || montantEnEuros === undefined) {
        return null;
      }
      if (devise === 'EUR' || !taux) {
        return montantEnEuros;
      }
      return convertir(montantEnEuros, taux);
    },
    [devise, taux]
  );

  // Points du graphe : la fenêtre de la plage choisie, puis la conversion d'affichage.
  // La conversion vient après le découpage, convertir des points qu'on ne trace pas
  // étant du travail perdu.
  const points = useMemo(
    () =>
      fenetreDePeriode(historique?.points ?? [], JOURS_PAR_PERIODE[periode]).map((point) => ({
        date: point.date_snapshot,
        valeur: afficher(point.valeur_totale_eur) ?? point.valeur_totale_eur,
      })),
    [historique, periode, afficher]
  );

  // Heure du dernier relevé. Le point du jour est écrit à la première actualisation de la
  // journée : son heure dépend de l'utilisateur, et la courbe doit le dire plutôt que de
  // laisser croire à un relevé de clôture.
  const dernierReleve = useMemo(() => {
    const serie = historique?.points ?? [];
    return serie.length > 0 ? formaterInstant(serie[serie.length - 1].heure_releve) : null;
  }, [historique]);

  const actifs = portefeuille?.actifs ?? [];
  const enRepli = actifs.filter((actif) => actif.source_cours === 'repli');
  const sansCours = portefeuille?.cours_indisponibles ?? [];
  const seuilsFranchis = portefeuille?.alertes_declenchees ?? [];

  // Le mouvement enregistré change le patrimoine, le prix de revient et les plus-values :
  // c'est le serveur qui les recalcule, l'écran se recharge plutôt que d'ajuster ses
  // chiffres de son côté.
  function apresEnregistrement({ resume }) {
    mouvement.fermer();
    setConfirmation(resume);
    actualiser();
  }

  const feuille = mouvement.ouvert && (
    <FeuilleMouvement
      actifs={portefeuille?.actifs ?? []}
      actifInitialId={mouvement.actifInitialId}
      surFermeture={mouvement.fermer}
      surEnregistrement={apresEnregistrement}
    />
  );

  const outils = (
    <div className="patrimoine__outils">
      <Bouton className="patrimoine__ajout" onClick={() => mouvement.ouvrir()}>
        + Mouvement
      </Bouton>
      {/* L'actualisation était implicite : le simple affichage de l'écran relevait les
          cours du jour et marquait les seuils franchis. Elle est désormais demandée,
          ici et au chargement de l'écran, et nulle part ailleurs. */}
      {/* `enCours` du composant Bouton impose le libellé « Envoi en cours… », qui
          conviendrait à une soumission de formulaire, pas à une relève de cours. */}
      <Bouton
        variante="secondaire"
        onClick={actualiser}
        desactive={chargement}
        aria-busy={chargement || undefined}
      >
        {chargement ? 'Actualisation…' : 'Actualiser'}
      </Bouton>
      <BasculeDevise
        devise={devise}
        indisponible={!taux}
        surChangement={(choix) => {
          setDevise(choix);
          ecrirePreference(CLE_DEVISE, choix);
        }}
      />
      <MasquageMontants
        masque={masque}
        surChangement={(valeur) => {
          setMasque(valeur);
          ecrirePreference(CLE_MASQUAGE, valeur ? 'oui' : 'non');
        }}
      />
    </div>
  );

  // Le squelette reprend la composition de l'écran : le bloc de patrimoine et la
  // répartition côte à côte, le graphe sur toute la largeur, puis les trois chiffres de
  // contexte. Le contenu remplace la forme sans rien déplacer.
  if (chargement && !portefeuille) {
    return (
      <div className="patrimoine" aria-busy="true">
        <h1 className="patrimoine__titre">Patrimoine</h1>
        <p className="lecteur-ecran-seulement" role="status">
          Chargement du patrimoine.
        </p>
        <div className="patrimoine__principal">
          <Squelette forme="bloc" />
          <Carte>
            <Squelette forme="ligne" />
            <Squelette forme="ligne" />
            <Squelette forme="ligne" />
          </Carte>
        </div>
        <Carte>
          <Squelette forme="graphe" />
        </Carte>
        <div className="patrimoine__contexte">
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
        </div>
      </div>
    );
  }

  if (erreur && !portefeuille) {
    const nature = natureDeLErreur(erreur);

    return (
      <div className="patrimoine">
        <h1 className="patrimoine__titre">Patrimoine</h1>
        <MessageErreur
          nature={nature}
          message={nature === 'api' ? erreur.message : undefined}
          libelleAction={nature === 'session' ? 'Se reconnecter' : 'Réessayer'}
          surAction={
            nature === 'session' ? () => naviguer('/connexion') : () => actualiser()
          }
        />
      </div>
    );
  }

  // Aucune position : ni courbe, ni répartition, ni chiffres. Un texte, une action.
  if (actifs.length === 0) {
    return (
      <div className="patrimoine">
        <h1 className="patrimoine__titre">Patrimoine</h1>
        <EtatVide
          titre={
            premierLancement
              ? `Bienvenue${utilisateur?.pseudo ? `, ${utilisateur.pseudo}` : ''}`
              : 'Aucune position'
          }
          explication={
            premierLancement
              ? "WalletWatch réunit vos cryptomonnaies, devises, métaux et actions en une seule vue, calcule votre prix de revient et suit vos plus-values. Commencez par enregistrer une première position."
              : "Votre portefeuille ne contient aucune position. Enregistrez un achat pour voir apparaître votre patrimoine et son évolution."
          }
          libelleAction="Ajouter votre première position"
          surAction={() => mouvement.ouvrir()}
        />
        {feuille}
      </div>
    );
  }

  const sens = sensVariation(historique?.performances?.[periode] ?? '0') ?? 'stable';

  return (
    <div className="patrimoine">
      <div className="patrimoine__entete">
        <h1 className="patrimoine__titre">Patrimoine</h1>
        {outils}
      </div>

      {/* Une erreur survenue alors que des données sont déjà affichées ne vide pas
          l'écran : le message s'ajoute, les valeurs précédentes restent lisibles. */}
      {erreur && (
        <MessageErreur
          nature={natureDeLErreur(erreur)}
          surAction={() => actualiser()}
          className="patrimoine__incident"
        />
      )}

      {/* Confirmation brève après un enregistrement. Elle n'est pas une alerte : elle
          confirme ce qui vient d'être demandé, sans interrompre. */}
      {confirmation && <Message>{confirmation}</Message>}

      {enRepli.length > 0 && (
        <Message variante="avertissement">
          Cours momentanément indisponible pour {enRepli.map((actif) => actif.symbole).join(', ')}.
          La valorisation utilise le dernier cours connu, relevé le{' '}
          {new Date(enRepli[0].horodatage_cours).toLocaleDateString('fr-FR')}.
        </Message>
      )}

      {sansCours.length > 0 && (
        <Message variante="avertissement">
          Aucun cours disponible pour {sansCours.join(', ')} : ces positions ne sont pas
          valorisées et n'entrent pas dans le total ci-dessous.
        </Message>
      )}

      <div className="patrimoine__principal">
        <section className="patrimoine__total" aria-labelledby="titre-patrimoine-total">
          <h2 id="titre-patrimoine-total" className="patrimoine__intitule">
            Valeur totale
          </h2>
          {masque ? (
            <p className="patrimoine__valeur" aria-label="Montant masqué">
              ••••••
            </p>
          ) : (
            <Montant
              valeur={afficher(portefeuille.valeur_totale)}
              devise={devise}
              taille="principal"
              className="patrimoine__valeur"
            />
          )}
          {/* Trois repères et non un seul chiffre suivi d'une file de variations. La
              carte portait le patrimoine puis deux valeurs collées à sa suite, sans dire
              laquelle répondait à quelle question ; elle en pose maintenant trois, chacune
              nommée. Le pourcentage est rapporté au coût des positions encore détenues, et
              non « depuis l'origine » : le sélecteur de période emploie déjà ce mot pour
              l'évolution de la valeur suivie, qui est un autre calcul. */}
          <dl className="patrimoine__reperes">
            <div className="patrimoine__repere">
              <dt>Gains latents</dt>
              <dd>
                {masque ? (
                  <span aria-label="Montant masqué">••••</span>
                ) : (
                  <Variation
                    valeur={afficher(portefeuille.plus_value_latente)}
                    mode="absolue"
                    devise={devise}
                    amplitude={portefeuille.pourcentage_variation}
                  />
                )}
              </dd>
            </div>
            <div className="patrimoine__repere">
              <dt>Progression</dt>
              <dd>
                {portefeuille.pourcentage_variation === null ? (
                  <span className="patrimoine__depuis">—</span>
                ) : (
                  <Variation valeur={portefeuille.pourcentage_variation} />
                )}
              </dd>
            </div>
          </dl>
          <p className="patrimoine__depuis">
            Gains et progression rapportés au coût des positions détenues.
          </p>
        </section>

        {/* Une répartition n'a de sens qu'à partir de deux positions. */}
        {actifs.length > 1 && portefeuille.repartition.length > 0 && (
          <Carte titre="Répartition" className="patrimoine__repartition">
            <Repartition repartition={portefeuille.repartition} devise={devise} masque={masque} />
          </Carte>
        )}
      </div>

      <Carte className="patrimoine__evolution">
        <SelecteurPeriode
          periode={periode}
          performances={historique?.performances ?? {}}
          surChangement={setPeriode}
          identifiantPanneau="panneau-evolution"
        />
        <div id="panneau-evolution" role="tabpanel" aria-labelledby={`onglet-periode-${periode}`}>
          {/* Une courbe à un seul point ne trace rien et laisse croire à une perte de
              données : un message prend sa place tant que le suivi est trop jeune. */}
          {points.length < 2 ? (
            <p className="patrimoine__evolution-absente">
              L'évolution s'affichera après quelques jours de suivi.
            </p>
          ) : (
            <Suspense fallback={<Squelette forme="graphe" />}>
              <Courbe points={points} devise={devise} masque={masque} sens={sens} />
            </Suspense>
          )}
        </div>

        {/* Le pas de la courbe n'est pas régulier, et le taire serait mentir sur un
            chiffre. Le point du jour est relevé à la première actualisation de la
            journée : deux points voisins peuvent être distants de trente-huit heures
            autant que de vingt-quatre. Un relevé à heure fixe demanderait un processus
            de fond, que D49 écarte du périmètre ; l'annoncer ne coûte rien. */}
        {points.length >= 2 && (
          <p className="patrimoine__legende">
            Relevé quotidien, pris à l'heure de votre consultation : l'écart entre deux
            points n'est pas exactement d'un jour.
            {dernierReleve && ` Dernier relevé le ${dernierReleve}.`}
          </p>
        )}
      </Carte>

      <dl className="patrimoine__contexte">
        <div className="patrimoine__ligne">
          <dt>Montant investi</dt>
          <dd>
            {masque ? (
              <span aria-label="Montant masqué">••••</span>
            ) : (
              <Montant valeur={afficher(portefeuille.cout_total)} devise={devise} />
            )}
          </dd>
        </div>
        <div className="patrimoine__ligne">
          <dt>Positions suivies</dt>
          <dd>{actifs.length}</dd>
        </div>
        <div className="patrimoine__ligne">
          <dt>Plus-value réalisée</dt>
          <dd>
            {masque ? (
              <span aria-label="Montant masqué">••••</span>
            ) : (
              <Variation
                valeur={afficher(portefeuille.plus_value_realisee)}
                mode="absolue"
                devise={devise}
              />
            )}
          </dd>
        </div>
      </dl>

      {/* Le bloc disparaît entièrement lorsqu'aucun seuil n'est franchi : une carte
          vide intitulée « Seuils franchis » inquiéterait pour rien. */}
      {seuilsFranchis.length > 0 && (
        <Carte titre="Seuils franchis">
          <ul className="patrimoine__seuils">
            {seuilsFranchis.map((seuil) => (
              <li key={seuil.id}>
                {/* Les valeurs comparées ici sont celles que contraint le schéma :
                    'actif' ou 'capital_total' pour la cible, 'au_dessus' ou 'en_dessous'
                    pour le sens. Elles se lisent dans backend/db/schema.sql, et non dans
                    une documentation qui pourrait avoir vieilli. */}
                {seuil.type_cible === 'capital_total'
                  ? 'Patrimoine total'
                  : (seuil.symbole ?? 'Position')}{' '}
                {seuil.sens_seuil === 'au_dessus' ? 'a dépassé' : 'est descendu sous'}{' '}
                <Montant valeur={afficher(seuil.valeur_seuil)} devise={devise} />
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {feuille}
    </div>
  );
}
