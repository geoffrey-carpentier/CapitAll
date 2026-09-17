import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { useMouvement } from '../hooks/useMouvement';
import { useSeuil } from '../hooks/useSeuil';
import { api, ErreurApi } from '../services/api';
import { convertir } from '../utils/conversion';
import { sensVariation } from '../utils/formatage';
import { LIBELLES_CLASSE } from '../utils/classesActifs';
import { fenetreDePeriode } from '../utils/serie';
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
import Champ from '../composants/Champ';
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

// La bibliothèque de tracé pèse plus que le reste de l'application : elle n'est chargée
// qu'à l'affichage du graphe.
const Courbe = lazy(() => import('../composants/Courbe'));

// Ce que la suppression recalcule dépend de la nature du mouvement.
const TITRES_SUPPRESSION = {
  achat: 'Supprimer cet achat ?',
  vente: 'Supprimer cette vente ?',
  sortie_non_marchande: 'Supprimer cette sortie ?',
};

const CONSEQUENCES_SUPPRESSION = {
  achat:
    'La suppression de cet achat recalculera le prix de revient de la position, ainsi que la quantité détenue et la plus-value latente.',
  vente:
    'La suppression de cette vente recalculera la quantité détenue et la plus-value réalisée de la position.',
  sortie_non_marchande:
    'La suppression de cette sortie recalculera la quantité détenue et la valeur sortie du portefeuille.',
};

// Fenêtre de chaque plage, en jours et non en points : la série est trouée (un point
// n'existe que les jours de consultation). Les bornes sont celles que le serveur
// applique pour calculer la performance affichée.
const JOURS_PAR_PERIODE = { jour: 1, semaine: 7, mois: 30, annee: 365, origine: null };

const PERIODE_PAR_DEFAUT = 'mois';

// Écran de détail d'une position : valeur, coût, historique des mouvements et seuils.
//
// Tout ce qui est chiffré vient de `GET /api/actifs/:id`, y compris l'effet de chaque
// mouvement sur le prix de revient. L'écran n'applique que le taux d'affichage, en
// arithmétique exacte.
//
// Une position d'un autre compte répond 404, comme une position inexistante : l'écran
// ne distingue pas les deux cas.

function natureDeLErreur(erreur) {
  if (!(erreur instanceof ErreurApi)) {
    return 'api';
  }
  if (erreur.statut === 0) {
    return 'reseau';
  }
  if (erreur.statut === 401) {
    return 'session';
  }
  // Un 400 est un refus, pas une panne : réessayer échouerait à l'identique.
  return erreur.statut === 400 ? 'refus' : 'api';
}

// Un seuil désactivé n'est pas affiché.
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
  // null hors édition ; la chaîne vide est un nom vide en cours d'édition.
  const [renommage, setRenommage] = useState(null);
  const [renommageEnCours, setRenommageEnCours] = useState(false);
  const [erreurRenommage, setErreurRenommage] = useState(null);
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

      // Un échec sur les seuils ne doit pas empêcher d'afficher la fiche.
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

  // Découpage à la plage avant conversion, pour ne convertir que les points tracés.
  const points = useMemo(() => {
    const serie = position?.historique?.points ?? [];
    const fenetre = fenetreDePeriode(serie, JOURS_PAR_PERIODE[periode]);

    return fenetre.map((point) => ({
      date: point.date_snapshot,
      valeur: afficher(point.cours_eur) ?? point.cours_eur,
    }));
  }, [position, periode, afficher]);

  async function confirmerRenommage(evenement) {
    evenement.preventDefault();
    const nom = renommage.trim();

    if (!nom) {
      setErreurRenommage('Le nom est obligatoire.');
      return;
    }

    setRenommageEnCours(true);
    setErreurRenommage(null);

    try {
      const renomme = await api.renommerActif(jeton, id, nom);
      // Affiche le nom enregistré par la base, pas le texte saisi.
      setPosition((precedente) => ({ ...precedente, nom: renomme.nom }));
      setRenommage(null);
      setConfirmation(`Position renommée en ${renomme.nom}.`);
    } catch (echec) {
      setErreurRenommage(echec.message);
    } finally {
      setRenommageEnCours(false);
    }
  }

  async function confirmerSuppression() {
    setSuppressionEnCours(true);

    try {
      if (aSupprimer.type === 'position') {
        await api.supprimerActif(jeton, id);
        naviguer('/positions', { replace: true });
        return;
      }

      await api.supprimerTransaction(jeton, id, aSupprimer.mouvement.id);
      setASupprimer(null);
      // Le serveur recalcule prix de revient et plus-values : l'écran se recharge.
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
          message={nature === 'api' || nature === 'refus' ? erreur.message : undefined}
          libelleAction={
            nature === 'session'
              ? 'Se reconnecter'
              : nature === 'refus'
                ? 'Revenir aux positions'
                : 'Réessayer'
          }
          surAction={
            nature === 'session'
              ? () => naviguer('/connexion')
              : nature === 'refus'
                ? () => naviguer('/positions')
                : charger
          }
        />
      </div>
    );
  }

  const classe = LIBELLES_CLASSE[position.type] ?? position.type;
  const enRepli = position.source_cours === 'repli';
  const sansCours = position.cours_eur === null;
  const mouvements = position.transactions ?? [];
  // Montants de la frise convertis pour l'affichage. La feuille de correction reçoit les
  // mouvements d'origine, en euros.
  const mouvementsAffiches = mouvements.map((mouvement) => ({
    ...mouvement,
    prix_unitaire: afficher(mouvement.prix_unitaire),
    montant: afficher(mouvement.montant),
    frais: afficher(mouvement.frais),
    cout_sortie: afficher(mouvement.cout_sortie),
    plus_value_realisee: afficher(mouvement.plus_value_realisee),
    effet_pru: afficher(mouvement.effet_pru),
  }));
  const performances = position.historique?.performances ?? {};

  // Le sens du tracé vient de la performance calculée par le serveur.
  const sensDeLaPeriode = sensVariation(performances[periode] ?? '0') ?? 'stable';
  const natureErreur = erreur ? natureDeLErreur(erreur) : null;

  return (
    <div className="detail">
      <div className="detail__entete">
        <Link to="/positions" className="detail__retour">
          <span aria-hidden="true">‹</span>
          <span className="lecteur-ecran-seulement">Revenir aux positions</span>
        </Link>

        <JetonClasse classe={position.type} symbole={position.symbole} />
        <div className="detail__identite">
          {/* Seul le nom est modifiable : symbole et classe identifient l'actif, et les
              changer modifierait la nature des mouvements déjà enregistrés. */}
          {renommage === null ? (
            <div className="detail__nom-ligne">
              <h1 className="detail__nom">{position.nom}</h1>
              <button
                type="button"
                className="detail__renommer"
                onClick={() => setRenommage(position.nom)}
              >
                <span aria-hidden="true">Renommer</span>
                <span className="lecteur-ecran-seulement">Renommer {position.nom}</span>
              </button>
            </div>
          ) : (
            <form className="detail__nom-ligne" onSubmit={confirmerRenommage}>
              <Champ
                label={`Nouveau nom de ${position.symbole}`}
                valeur={renommage}
                onChange={(evenement) => setRenommage(evenement.target.value)}
                erreur={erreurRenommage ?? undefined}
                maxLength={100}
                autoComplete="off"
                disabled={renommageEnCours}
              />
              <Bouton type="submit" enCours={renommageEnCours} desactive={!renommage.trim()}>
                Enregistrer
              </Bouton>
              <Bouton
                variante="secondaire"
                onClick={() => {
                  setRenommage(null);
                  setErreurRenommage(null);
                }}
                desactive={renommageEnCours}
              >
                Annuler
              </Bouton>
            </form>
          )}
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

      {/* Une erreur postérieure au chargement ne vide pas la fiche. Un refus métier
          n'offre pas de nouvelle tentative. */}
      {erreur && position && (
        <MessageErreur
          nature={natureErreur}
          message={natureErreur === 'refus' ? erreur.message : undefined}
          surAction={natureErreur === 'refus' ? undefined : charger}
        />
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

      <div className="detail__principal">
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
        <dl className="detail__reperes">
          <div className="detail__marqueur">
            <dt>Gains latents</dt>
            <dd>
              {masque ? (
                <span aria-label="Montant masqué">••••</span>
              ) : (
                <Variation
                  valeur={afficher(position.plus_value_latente)}
                  mode="absolue"
                  devise={devise}
                  amplitude={position.pourcentage_variation}
                />
              )}
            </dd>
          </div>
          <div className="detail__marqueur">
            <dt>Progression</dt>
            <dd>
              {position.pourcentage_variation === null ? (
                <span className="detail__depuis">—</span>
              ) : (
                <Variation valeur={position.pourcentage_variation} />
              )}
            </dd>
          </div>
        </dl>
      </section>

      <dl className="detail__trio">
        <div className="detail__repere">
          <dt>Quantité détenue</dt>
          <dd>
            {masque ? (
              <span aria-label="Quantité masquée">•••• {position.symbole}</span>
            ) : (
              <Montant
                valeur={position.quantite_detenue}
                type="quantite"
                classe={position.type}
                symbole={position.symbole}
              />
            )}
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
      </div>

      {/* Graphe du cours : l'aire se teinte de part et d'autre de la ligne du prix de
          revient, pour montrer les périodes de gain et de perte. */}
      <Carte className="detail__evolution">
        <SelecteurPeriode
          periode={periode}
          performances={performances}
          surChangement={setPeriode}
          identifiantPanneau="panneau-cours"
        />
        <div id="panneau-cours" role="tabpanel" aria-labelledby={`onglet-periode-${periode}`}>
          {/* L'historique commence à la première consultation et n'est jamais
              interpolé. */}
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
              mouvements={mouvementsAffiches}
              classe={position.type}
              symbole={position.symbole}
              devise={devise}
              masque={masque}
              surCorrection={(aCorriger) => mouvement.corriger(position.id, aCorriger.id)}
              surSuppression={(aRetirer) => setASupprimer({ type: 'mouvement', mouvement: aRetirer })}
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
                        {/* Valeurs contraintes par le schéma : 'au_dessus' ou 'en_dessous'. */}
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
          titre={TITRES_SUPPRESSION[aSupprimer.mouvement.sens] ?? 'Supprimer ce mouvement ?'}
          consequence={
            CONSEQUENCES_SUPPRESSION[aSupprimer.mouvement.sens] ??
            'La suppression de ce mouvement recalculera la position.'
          }
          libelleConfirmation="Supprimer le mouvement"
          enCours={suppressionEnCours}
          surConfirmation={confirmerSuppression}
          surAnnulation={() => setASupprimer(null)}
        />
      )}

      {/* La feuille reçoit la seule position de l'écran, avec ses montants en euros. */}
      {mouvement.ouvert && (
        <FeuilleMouvement
          actifs={[position]}
          actifInitialId={position.id}
          // Un identifiant de correction inconnu (mouvement supprimé depuis) ouvre la
          // feuille en création plutôt qu'en erreur.
          mouvement={
            mouvement.idCorrection
              ? (mouvements.find(
                  (element) => String(element.id) === String(mouvement.idCorrection)
                ) ?? null)
              : null
          }
          surFermeture={mouvement.fermer}
          surEnregistrement={({ resume }) => {
            mouvement.fermer();
            setConfirmation(resume);
            charger();
          }}
        />
      )}

      {/* Seuil pré-réglé sur cette position : la cible « patrimoine total » n'est pas
          proposée, l'écran ne chargeant pas la valeur totale. */}
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
