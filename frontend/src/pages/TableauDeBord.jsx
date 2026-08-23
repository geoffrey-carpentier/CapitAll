import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { api, ErreurApi } from '../services/api';
import { convertir } from '../utils/conversion';
import { sensVariation } from '../utils/formatage';
import Carte from '../composants/Carte';
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
import './TableauDeBord.css';

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

const JOURS_PAR_PERIODE = { jour: 1, semaine: 7, mois: 30, annee: 365, origine: undefined };

// Période par défaut : le mois, plus proche du rythme réel de consultation. L'année
// reste à un clic.
const PERIODE_PAR_DEFAUT = 'mois';

const CLE_DEVISE = 'capitall.devise';
const CLE_MASQUAGE = 'capitall.masquage';

// Préférences d'affichage conservées le temps de la session. Le stockage local
// survivrait à la fermeture du navigateur, ce qui n'aurait pas de sens pour un jeton qui
// ne survit pas au rechargement, et laisserait une trace sur un poste partagé.
function lirePreference(cle, valeurParDefaut) {
  try {
    return window.sessionStorage.getItem(cle) ?? valeurParDefaut;
  } catch {
    // Navigation privée stricte ou stockage refusé : l'écran fonctionne sans mémoire.
    return valeurParDefaut;
  }
}

function ecrirePreference(cle, valeur) {
  try {
    window.sessionStorage.setItem(cle, valeur);
  } catch {
    // Sans conséquence : seule la persistance est perdue, pas le comportement.
  }
}

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

export default function TableauDeBord() {
  const { jeton, utilisateur } = useAuthentification();
  const naviguer = useNavigate();
  const emplacement = useLocation();

  const [portefeuille, setPortefeuille] = useState(null);
  const [historique, setHistorique] = useState(null);
  const [periode, setPeriode] = useState(PERIODE_PAR_DEFAUT);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  const [devise, setDevise] = useState(() => lirePreference(CLE_DEVISE, 'EUR'));
  const [masque, setMasque] = useState(() => lirePreference(CLE_MASQUAGE, 'non') === 'oui');

  // L'arrivée depuis l'inscription est signalée par la navigation : c'est ce qui
  // distingue un premier lancement d'un portefeuille devenu vide.
  const premierLancement = emplacement.state?.premierLancement === true;

  const charger = useCallback(
    async (periodeDemandee) => {
      setChargement(true);
      setErreur(null);

      try {
        const [donnees, serie] = await Promise.all([
          api.portefeuille(jeton),
          api.historique(jeton, JOURS_PAR_PERIODE[periodeDemandee]),
        ]);
        setPortefeuille(donnees);
        setHistorique(serie);
      } catch (echec) {
        setErreur(echec);
      } finally {
        setChargement(false);
      }
    },
    [jeton]
  );

  useEffect(() => {
    charger(periode);
  }, [charger, periode]);

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

  const points = useMemo(
    () =>
      (historique?.points ?? []).map((point) => ({
        date: point.date_snapshot,
        valeur: afficher(point.valeur_totale_eur) ?? point.valeur_totale_eur,
      })),
    [historique, afficher]
  );

  const actifs = portefeuille?.actifs ?? [];
  const enRepli = actifs.filter((actif) => actif.source_cours === 'repli');
  const sansCours = portefeuille?.cours_indisponibles ?? [];
  const seuilsFranchis = portefeuille?.alertes_declenchees ?? [];

  const outils = (
    <div className="patrimoine__outils">
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

  // Le squelette reprend la composition de l'écran : un grand bloc, une zone de graphe,
  // trois lignes, un cercle. Le contenu remplace la forme sans rien déplacer.
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
            <Squelette forme="graphe" />
          </Carte>
        </div>
        <div className="patrimoine__contexte">
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
        </div>
        <Carte>
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
        </Carte>
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
            nature === 'session' ? () => naviguer('/connexion') : () => charger(periode)
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
              ? "CapitAll réunit vos cryptomonnaies, devises, métaux et actions en une seule vue, calcule votre prix de revient et suit vos plus-values. Commencez par enregistrer une première position."
              : "Votre portefeuille ne contient aucune position. Enregistrez un achat pour voir apparaître votre patrimoine et son évolution."
          }
          libelleAction="Ajouter votre première position"
          surAction={() => naviguer('/mouvement')}
        />
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
          surAction={() => charger(periode)}
          className="patrimoine__incident"
        />
      )}

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
          <p className="patrimoine__variations">
            {!masque && (
              <Variation
                valeur={afficher(portefeuille.plus_value_latente)}
                mode="absolue"
                devise={devise}
                amplitude={portefeuille.pourcentage_variation}
              />
            )}
            {portefeuille.pourcentage_variation !== null && (
              <Variation valeur={portefeuille.pourcentage_variation} />
            )}
            <span className="patrimoine__depuis">depuis l'origine</span>
          </p>
        </section>

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
        </Carte>
      </div>

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
          <dt>Plus-value latente</dt>
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

      {/* Une répartition n'a de sens qu'à partir de deux positions. */}
      {actifs.length > 1 && portefeuille.repartition.length > 0 && (
        <Carte titre="Répartition">
          <Repartition repartition={portefeuille.repartition} devise={devise} masque={masque} />
        </Carte>
      )}

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
    </div>
  );
}
