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

// La bibliothèque de tracé pèse plus que le reste de l'application : chargée à la
// demande, elle ne retarde pas l'affichage du patrimoine sur mobile.
const Courbe = lazy(() => import('../composants/Courbe'));

// Écran Patrimoine : valeur totale, évolution, répartition et seuils franchis.
// Les montants passent par le composant Montant ; l'écran n'applique que le taux
// d'affichage, en arithmétique exacte.

// Fenêtre de chaque plage, découpée côté interface dans la série déjà reçue : changer de
// plage ne rappelle pas le serveur.
const JOURS_PAR_PERIODE = { jour: 1, semaine: 7, mois: 30, annee: 365, origine: null };

const PERIODE_PAR_DEFAUT = 'mois';

function natureDeLErreur(erreur) {
  if (!(erreur instanceof ErreurApi)) {
    return 'api';
  }
  // Statut 0 : la requête n'a reçu aucune réponse.
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

  // Distingue l'arrivée depuis l'inscription d'un portefeuille devenu vide.
  const premierLancement = emplacement.state?.premierLancement === true;

  // Commande explicite qui relève le point du jour et évalue les seuils : seul appel
  // de consultation qui écrit en base. Elle ne dépend pas de la période affichée.
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

  // Découpage à la plage avant conversion, pour ne convertir que les points tracés.
  const points = useMemo(
    () =>
      fenetreDePeriode(historique?.points ?? [], JOURS_PAR_PERIODE[periode]).map((point) => ({
        date: point.date_snapshot,
        valeur: afficher(point.valeur_totale_eur) ?? point.valeur_totale_eur,
      })),
    [historique, periode, afficher]
  );

  // Le point du jour est pris à la première actualisation : son heure varie, et la
  // légende l'indique.
  const dernierReleve = useMemo(() => {
    const serie = historique?.points ?? [];
    return serie.length > 0 ? formaterInstant(serie[serie.length - 1].heure_releve) : null;
  }, [historique]);

  const actifs = portefeuille?.actifs ?? [];
  const enRepli = actifs.filter((actif) => actif.source_cours === 'repli');
  const sansCours = portefeuille?.cours_indisponibles ?? [];
  const seuilsFranchis = portefeuille?.alertes_declenchees ?? [];

  // Le serveur recalcule tout après un mouvement : l'écran se recharge.
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
      {/* `enCours` de Bouton afficherait « Envoi en cours… », libellé de formulaire. */}
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

  // Le squelette reprend la composition de l'écran pour éviter tout décalage.
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

      {/* Une erreur postérieure au chargement laisse les valeurs précédentes lisibles. */}
      {erreur && (
        <MessageErreur
          nature={natureDeLErreur(erreur)}
          surAction={() => actualiser()}
          className="patrimoine__incident"
        />
      )}

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
          {/* Le pourcentage est rapporté au coût des positions détenues, à ne pas
              confondre avec la performance « depuis l'origine » du sélecteur de période. */}
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
            {/* Montants en euros : ils doivent être convertis comme le total. */}
            <Repartition
              repartition={portefeuille.repartition.map((part) => ({
                ...part,
                valeur: afficher(part.valeur),
              }))}
              devise={devise}
              masque={masque}
            />
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

        {/* Pas de relevé à heure fixe (aucune tâche planifiée) : l'écart entre deux
            points varie, la légende le signale. */}
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

      {seuilsFranchis.length > 0 && (
        <Carte titre="Seuils franchis">
          <ul className="patrimoine__seuils">
            {seuilsFranchis.map((seuil) => (
              <li key={seuil.id}>
                {/* Valeurs contraintes par le schéma : cible 'actif' ou 'capital_total',
                    sens 'au_dessus' ou 'en_dessous'. */}
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
