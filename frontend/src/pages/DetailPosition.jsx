import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { api, ErreurApi } from '../services/api';
import { convertir } from '../utils/conversion';
import { LIBELLES_CLASSE } from '../utils/classesActifs';
import Carte from '../composants/Carte';
import Montant from '../composants/Montant';
import Variation from '../composants/Variation';
import JetonClasse from '../composants/JetonClasse';
import PastilleFraicheur from '../composants/PastilleFraicheur';
import Onglets from '../composants/Onglets';
import FriseMouvements from '../composants/FriseMouvements';
import BarreProgression from '../composants/BarreProgression';
import Confirmation from '../composants/Confirmation';
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
  const [aSupprimer, setASupprimer] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

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
          ) : seuils.length === 0 ? (
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
                    <Montant valeur={afficher(seuil.valeur_seuil)} devise={devise} />
                    {seuil.statut === 'declenchee' && (
                      <span className="detail__seuil-franchi">franchi</span>
                    )}
                  </p>
                  <BarreProgression
                    valeur={afficher(position.cours_eur)}
                    cible={afficher(seuil.valeur_seuil)}
                    devise={devise}
                    sens={seuil.sens_seuil}
                    atteint={seuil.statut === 'declenchee'}
                    libelle={`Progression vers le seuil de ${position.symbole}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Carte>

      <div className="detail__actions">
        <Bouton variante="secondaire" onClick={() => naviguer('/mouvement')}>
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
    </div>
  );
}
