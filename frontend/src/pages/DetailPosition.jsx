import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { useMouvement } from '../hooks/useMouvement';
import { useSeuil } from '../hooks/useSeuil';
import { api, ErreurApi } from '../services/api';
import { convertir } from '../utils/conversion';
import { sensVariation } from '../utils/formatage';
import { LIBELLES_CLASSE } from '../utils/classesActifs';
import Carte from '../composants/Carte';
import Montant from '../composants/Montant';
import Variation from '../composants/Variation';
import JetonClasse from '../composants/JetonClasse';
import PastilleFraicheur from '../composants/PastilleFraicheur';
import Onglets from '../composants/Onglets';
import SelecteurPeriode from '../composants/SelecteurPeriode';
import FriseMouvements from '../composants/FriseMouvements';
import BarreProgression from '../composants/BarreProgression';
import Confirmation from '../composants/Confirmation';
import FeuilleMouvement from '../composants/FeuilleMouvement';
import FeuilleSeuil from '../composants/FeuilleSeuil';
import Bouton from '../composants/Bouton';
import Squelette from '../composants/Squelette';
import MessageErreur from '../composants/MessageErreur';
import Message from '../composants/Message';
import EtatVide from '../composants/EtatVide';
import BasculeDevise from '../composants/BasculeDevise';
import MasquageMontants from '../composants/MasquageMontants';
import {
  lirePreference,
  ecrirePreference,
  CLE_DEVISE,
  CLE_MASQUAGE,
} from '../utils/preferences';
import './DetailPosition.css';

// Même arbitrage que sur le tableau de bord : la bibliothèque de tracé pèse plus lourd
// que tout le reste de l'application, elle n'est chargée qu'à l'affichage du graphe.
const Courbe = lazy(() => import('../composants/Courbe'));

// Nombre de points repris pour chaque plage. La série est journalière et continue :
// borner la fenêtre revient à en garder la fin. C'est de la présentation, les
// performances de chaque plage restant calculées par le serveur sur la série entière.
const JOURS_PAR_PERIODE = { jour: 2, semaine: 7, mois: 30, annee: 365, origine: null };

const PERIODE_PAR_DEFAUT = 'mois';

// Écran de détail d'une position.
//
// Il répond à quatre questions : ce que la position vaut, ce qu'elle a coûté, comment
// on y est arrivé, et ce qui la surveille. La composition suit cet ordre.
//
// Tout ce qui est chiffré vient de `GET /api/actifs/:id`. L'effet de chaque mouvement
// sur le prix de revient y compris : il est calculé par le serveur, qui détient le
// moteur, et non reconstitué ici (D69). Les seules opérations numériques de l'écran
// sont l'application du taux d'affichage, en arithmétique exacte, et la géométrie des
// barres de progression.
//
// Une position appartenant à un autre compte répond 404 et non 403 (D52). L'écran la
// traite donc exactement comme une position inexistante, sans chercher à distinguer
// les deux : c'est précisément ce que la règle vise.

function natureDeLErreur(erreur) {
  if (!(erreur instanceof ErreurApi)) {
    return 'api';
  }
  if (erreur.statut === 0) {
    return 'reseau';
  }
  return erreur.statut === 401 ? 'session' : 'api';
}

// Seuls les seuils encore en vigueur ou déjà franchis concernent l'écran : un seuil
// désactivé n'a plus rien à surveiller.
const STATUTS_AFFICHES = ['active', 'declenchee'];

export default function DetailPosition() {
  const { id } = useParams();
  const { jeton } = useAuthentification();
  const naviguer = useNavigate();

  const [position, setPosition] = useState(null);
  const [seuils, setSeuils] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('mouvements');
  const [periode, setPeriode] = useState(PERIODE_PAR_DEFAUT);
  const [aSupprimer, setASupprimer] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const mouvement = useMouvement();
  const seuilFeuille = useSeuil();

  const [devise, setDevise] = useState(() => lirePreference(CLE_DEVISE, 'EUR'));
  const [masque, setMasque] = useState(() => lirePreference(CLE_MASQUAGE, 'non') === 'oui');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    try {
      const detail = await api.actif(jeton, id);
      setPosition(detail);

      // Les seuils sont secondaires : leur indisponibilité ne doit pas emporter la
      // fiche entière, qui reste lisible sans l'onglet de surveillance.
      try {
        const alertes = await api.alertes(jeton);
        setSeuils(
          alertes.filter(
            (alerte) =>
              String(alerte.actif_id) === String(id) && STATUTS_AFFICHES.includes(alerte.statut)
          )
        );
      } catch {
        setSeuils([]);
      }
    } catch (echec) {
      setErreur(echec);
    } finally {
      setChargement(false);
    }
  }, [jeton, id]);

  useEffect(() => {
    charger();
  }, [charger]);

  const taux = position?.taux_affichage?.eur_vers_usd ?? null;

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

  // Points du graphe, bornés à la plage choisie puis convertis à l'affichage. La
  // conversion vient après le découpage : convertir quatre-vingt-dix points pour n'en
  // tracer sept serait du travail perdu.
  const points = useMemo(() => {
    const serie = position?.historique?.points ?? [];
    const jours = JOURS_PAR_PERIODE[periode];
    const fenetre = jours ? serie.slice(-jours) : serie;

    return fenetre.map((point) => ({
      date: point.date_snapshot,
      valeur: afficher(point.cours_eur) ?? point.cours_eur,
    }));
  }, [position, periode, afficher]);

  async function confirmerSuppression() {
    setSuppressionEnCours(true);

    try {
      if (aSupprimer.type === 'position') {
        await api.supprimerActif(jeton, id);
        // La position n'existe plus : rester sur sa fiche afficherait un écran mort.
        naviguer('/positions', { replace: true });
        return;
      }

      await api.supprimerTransaction(jeton, id, aSupprimer.mouvement.id);
      setASupprimer(null);
      // Le prix de revient et toutes les valeurs qui en dépendent viennent de changer :
      // c'est le serveur qui les recalcule, l'écran se recharge plutôt que de retirer
      // une ligne de son côté.
      await charger();
    } catch (echec) {
      setASupprimer(null);
      setErreur(echec);
    } finally {
      setSuppressionEnCours(false);
    }
  }

  if (chargement && !position) {
    return (
      <div className="detail" aria-busy="true">
        <p className="lecteur-ecran-seulement" role="status">
          Chargement de la position.
        </p>
        <Squelette forme="ligne" />
        <Squelette forme="bloc" />
        <Carte>
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
        </Carte>
      </div>
    );
  }

  // Une position introuvable, ou appartenant à un autre compte : le serveur répond 404
  // dans les deux cas et l'écran ne fait pas la différence non plus.
  if (erreur && !position) {
    const nature = natureDeLErreur(erreur);

    if (erreur instanceof ErreurApi && erreur.statut === 404) {
      return (
        <div className="detail">
          <EtatVide
            titre="Position introuvable"
            explication="Cette position n'existe pas ou n'est plus suivie."
            libelleAction="Revenir aux positions"
            surAction={() => naviguer('/positions')}
          />
        </div>
      );
    }

    return (
      <div className="detail">
        <MessageErreur
          nature={nature}
          message={nature === 'api' ? erreur.message : undefined}
          libelleAction={nature === 'session' ? 'Se reconnecter' : 'Réessayer'}
          surAction={nature === 'session' ? () => naviguer('/connexion') : charger}
        />
      </div>
    );
  }

  const classe = LIBELLES_CLASSE[position.type] ?? position.type;
  const enRepli = position.source_cours === 'repli';
  const sansCours = position.cours_eur === null;
  const mouvements = position.transactions ?? [];
  const performances = position.historique?.performances ?? {};

  // Le sens du tracé vient de la performance calculée par le serveur, jamais d'une
  // comparaison entre deux montants convertis en nombres.
  const sensDeLaPeriode = sensVariation(performances[periode] ?? '0') ?? 'stable';

  return (
    <div className="detail">
      <div className="detail__entete">
        <Link to="/positions" className="detail__retour">
          <span aria-hidden="true">‹</span>
          <span className="lecteur-ecran-seulement">Revenir aux positions</span>
        </Link>

        <JetonClasse classe={position.type} />
        <div className="detail__identite">
          <h1 className="detail__nom">{position.nom}</h1>
          <p className="detail__signalement">
            <span>
              {position.symbole} · {classe}
            </span>
            {position.source_cours && (
              <PastilleFraicheur
                source={position.source_cours}
                horodatage={position.horodatage_cours}
                enRepli={enRepli}
              />
            )}
          </p>
        </div>

        <div className="detail__outils">
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
      </div>

      {/* Une erreur survenue alors que la fiche est déjà affichée ne la vide pas. */}
      {erreur && position && (
        <MessageErreur nature={natureDeLErreur(erreur)} surAction={charger} />
      )}

      {confirmation && <Message>{confirmation}</Message>}

      {sansCours && (
        <Message variante="avertissement">
          Aucun cours disponible pour {position.symbole} : cette position n'est pas valorisée.
        </Message>
      )}

      {enRepli && (
        <Message variante="avertissement">
          Cours momentanément indisponible : la valorisation utilise le dernier cours connu.
        </Message>
      )}

      <section className="detail__valorisation" aria-labelledby="titre-valorisation">
        <h2 id="titre-valorisation" className="detail__intitule">
          Valorisation de la position
        </h2>
        {masque ? (
          <p className="detail__valeur" aria-label="Montant masqué">
            ••••••
          </p>
        ) : (
          <Montant
            valeur={afficher(position.valeur)}
            devise={devise}
            taille="principal"
            className="detail__valeur"
          />
        )}
        <p className="detail__variations">
          {!masque && (
            <Variation
              valeur={afficher(position.plus_value_latente)}
              mode="absolue"
              devise={devise}
              amplitude={position.pourcentage_variation}
            />
          )}
          {position.pourcentage_variation !== null && (
            <Variation valeur={position.pourcentage_variation} />
          )}
          <span className="detail__depuis">de plus-value latente</span>
        </p>
      </section>

      <dl className="detail__trio">
        <div className="detail__repere">
          <dt>Quantité détenue</dt>
          <dd>
            <Montant
              valeur={position.quantite_detenue}
              type="quantite"
              classe={position.type}
              symbole={position.symbole}
            />
          </dd>
        </div>
        <div className="detail__repere">
          <dt>Cours actuel</dt>
          <dd>
            {masque ? (
              <span aria-label="Montant masqué">••••</span>
            ) : (
              <Montant valeur={afficher(position.cours_eur)} type="cours" devise={devise} />
            )}
          </dd>
        </div>
        <div className="detail__repere">
          <dt>Prix de revient</dt>
          <dd>
            {masque ? (
              <span aria-label="Montant masqué">••••</span>
            ) : (
              <Montant valeur={afficher(position.pru)} type="cours" devise={devise} />
            )}
          </dd>
        </div>
      </dl>

      {/*
        Le graphe de cours et sa ligne de prix de revient (D79). L'aire se teinte de part
        et d'autre de cette ligne : c'est le geste graphique propre à l'application, celui
        qui donne à voir d'un regard quand la position a été en gain et quand elle a été
        en perte. Il s'insère entre le trio de contexte et la carte à onglets.
      */}
      <Carte className="detail__evolution">
        <SelecteurPeriode
          periode={periode}
          performances={performances}
          surChangement={setPeriode}
          identifiantPanneau="panneau-cours"
        />
        <div id="panneau-cours" role="tabpanel" aria-labelledby={`onglet-periode-${periode}`}>
          {/* Une série trop courte ne trace rien et laisserait croire à une perte de
              données. L'historique s'amorce à la première consultation : il n'est jamais
              interpolé pour combler les jours manquants. */}
          {points.length < 2 ? (
            <p className="detail__evolution-absente">
              L'évolution du cours s'affichera après quelques jours de suivi.
            </p>
          ) : (
            <Suspense fallback={<Squelette forme="graphe" />}>
              <Courbe
                points={points}
                devise={devise}
                masque={masque}
                sens={sensDeLaPeriode}
                prixDeRevient={afficher(position.pru)}
                sujet={`du cours de ${position.nom}`}
              />
            </Suspense>
          )}
        </div>
      </Carte>

      <Carte className="detail__onglets">
        <Onglets
          libelle="Détail de la position"
          identifiantPanneau="panneau-detail"
          actif={onglet}
          surChangement={setOnglet}
          onglets={[
            { code: 'mouvements', libelle: 'Mouvements', compteur: mouvements.length },
            { code: 'seuils', libelle: 'Seuils', compteur: seuils.length },
          ]}
        />

        <div id="panneau-detail" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
          {onglet === 'mouvements' ? (
            <FriseMouvements
              mouvements={mouvements}
              classe={position.type}
              symbole={position.symbole}
              devise={devise}
              masque={masque}
              surSuppression={(mouvement) => setASupprimer({ type: 'mouvement', mouvement })}
            />
          ) : (
            <>
              <div className="detail__seuils-outils">
                <Bouton variante="secondaire" onClick={() => seuilFeuille.ouvrir(position.id)}>
                  + Seuil
                </Bouton>
              </div>

              {seuils.length === 0 ? (
                <p className="detail__sans-seuil">
                  Aucun seuil ne surveille cette position.
                </p>
              ) : (
                <ul className="detail__seuils">
                  {seuils.map((seuil) => (
                    <li key={seuil.id}>
                      <p className="detail__seuil-intitule">
                        {/* Valeurs contraintes par le schéma : 'au_dessus' ou 'en_dessous'.
                            Elles se lisent dans backend/db/schema.sql. */}
                        {seuil.sens_seuil === 'au_dessus' ? 'Au-dessus de' : 'En dessous de'}{' '}
                        {masque ? (
                          <span aria-label="Montant masqué">••••</span>
                        ) : (
                          <Montant valeur={afficher(seuil.valeur_seuil)} devise={devise} />
                        )}
                        {seuil.statut === 'declenchee' && (
                          <span className="detail__seuil-franchi">franchi</span>
                        )}
                      </p>
                      <BarreProgression
                        valeur={afficher(position.cours_eur)}
                        cible={afficher(seuil.valeur_seuil)}
                        devise={devise}
                        masque={masque}
                        sens={seuil.sens_seuil}
                        atteint={seuil.statut === 'declenchee'}
                        libelle={`Progression vers le seuil de ${position.symbole}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Carte>

      <div className="detail__actions">
        {/* La feuille s'ouvre déjà réglée sur cette position : elle est la seule que
            l'écran connaisse, et le sélecteur n'aurait rien d'autre à proposer. */}
        <Bouton variante="secondaire" onClick={() => mouvement.ouvrir(position.id)}>
          Nouveau mouvement
        </Bouton>
        <Bouton variante="danger" onClick={() => setASupprimer({ type: 'position' })}>
          Supprimer la position
        </Bouton>
      </div>

      {aSupprimer?.type === 'position' && (
        <Confirmation
          titre={`Supprimer ${position.nom} ?`}
          consequence={`Les ${mouvements.length} mouvement${mouvements.length > 1 ? 's' : ''} enregistré${mouvements.length > 1 ? 's' : ''} sur cette position seront supprimés avec elle, ainsi que les seuils qui la surveillent. Le prix de revient et les plus-values de cette position seront perdus. Cette opération est irréversible.`}
          libelleConfirmation="Supprimer la position"
          enCours={suppressionEnCours}
          surConfirmation={confirmerSuppression}
          surAnnulation={() => setASupprimer(null)}
        />
      )}

      {aSupprimer?.type === 'mouvement' && (
        <Confirmation
          titre={
            aSupprimer.mouvement.sens === 'achat' ? 'Supprimer cet achat ?' : 'Supprimer cette vente ?'
          }
          consequence={
            aSupprimer.mouvement.sens === 'achat'
              ? "La suppression de cet achat recalculera le prix de revient de la position, ainsi que la quantité détenue et la plus-value latente."
              : "La suppression de cette vente recalculera la quantité détenue et la plus-value réalisée de la position."
          }
          libelleConfirmation="Supprimer le mouvement"
          enCours={suppressionEnCours}
          surConfirmation={confirmerSuppression}
          surAnnulation={() => setASupprimer(null)}
        />
      )}

      {/* L'écran de détail ne connaît qu'une position : la feuille reçoit celle-ci et
          elle seule, avec son cours et sa quantité détenue, sans requête de plus. Les
          montants transmis sont ceux du serveur, en euros, et non ceux convertis pour
          l'affichage : la saisie se fait dans la devise de référence. */}
      {mouvement.ouvert && (
        <FeuilleMouvement
          actifs={[position]}
          actifInitialId={position.id}
          surFermeture={mouvement.fermer}
          surEnregistrement={({ resume }) => {
            mouvement.fermer();
            setConfirmation(resume);
            charger();
          }}
        />
      )}

      {/* Même principe que la feuille de mouvement ci-dessus : l'écran de détail ne
          connaît qu'une position, donc qu'une cible possible. Le sélecteur de
          patrimoine total est retiré (spécification E4, « Création d'un seuil
          pré-réglée sur cet actif ») plutôt que de charger la valeur totale du
          patrimoine pour cette seule occasion. */}
      {seuilFeuille.ouvert && (
        <FeuilleSeuil
          actifs={[position]}
          permettrePatrimoineTotal={false}
          cibleInitiale={seuilFeuille.cibleInitiale}
          surFermeture={seuilFeuille.fermer}
          surEnregistrement={({ resume }) => {
            seuilFeuille.fermer();
            setConfirmation(resume);
            charger();
          }}
        />
      )}
    </div>
  );
}
