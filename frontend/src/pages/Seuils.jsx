import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { useMouvement } from '../hooks/useMouvement';
import { useSeuil } from '../hooks/useSeuil';
import { api, ErreurApi } from '../services/api';
import { convertir } from '../utils/conversion';
import { formaterMontant, symboleDevise } from '../utils/formatage';
import { lirePreference, ecrirePreference, CLE_DEVISE, CLE_MASQUAGE } from '../utils/preferences';
import Bouton from '../composants/Bouton';
import Carte from '../composants/Carte';
import JetonClasse from '../composants/JetonClasse';
import Montant from '../composants/Montant';
import BarreProgression from '../composants/BarreProgression';
import FeuilleMouvement from '../composants/FeuilleMouvement';
import FeuilleSeuil from '../composants/FeuilleSeuil';
import Confirmation from '../composants/Confirmation';
import EtatVide from '../composants/EtatVide';
import Squelette from '../composants/Squelette';
import MessageErreur from '../composants/MessageErreur';
import Message from '../composants/Message';
import BasculeDevise from '../composants/BasculeDevise';
import MasquageMontants from '../composants/MasquageMontants';
import './Seuils.css';

// Écran Seuils.
//
// Il répond à une seule question devant chaque ligne : suis-je proche ? Deux groupes,
// les seuils franchis puis ceux en cours, plutôt qu'un filtre à bascule : la
// spécification les veut visibles ensemble, le franchissement étant l'information la
// plus importante et devant donc ouvrir la liste plutôt que se cacher derrière un clic.
//
// L'écart restant avant franchissement est une valeur dérivée d'un montant : elle vient
// déjà calculée dans la réponse de `GET /api/alertes`, avec la valeur actuellement
// observée sur la cible (D69). Rien n'est recalculé ici. Il est écrit en toutes lettres
// à côté de la barre de progression, qui ne porte jamais seule l'information.
//
// Un seuil désactivé ne surveille plus rien : comme dans l'onglet Seuils de l'écran de
// détail, il disparaît de la liste après son retrait plutôt que d'y rester barré.
//
// La devise d'affichage et le masquage des montants sont des préférences globales,
// déjà appliquées aux écrans Patrimoine, Positions et Détail d'une position : cet écran
// reprend exactement le même mécanisme (D83), y compris dans le texte de confirmation
// du retrait, qui masque le seuil au même titre que n'importe quel autre montant
// affiché — rien ne justifie qu'un dialogue de confirmation échappe à une préférence
// qui s'applique partout ailleurs.
const STATUTS_AFFICHES = ['active', 'declenchee'];

function natureDeLErreur(erreur) {
  if (!(erreur instanceof ErreurApi)) {
    return 'api';
  }
  if (erreur.statut === 0) {
    return 'reseau';
  }
  return erreur.statut === 401 ? 'session' : 'api';
}

function formaterDate(horodatage) {
  const date = new Date(horodatage);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nomCible(seuil) {
  return seuil.type_cible === 'capital_total' ? 'Patrimoine total' : (seuil.nom_actif ?? seuil.symbole);
}

// Retrait d'un seuil.
//
// Le bouton était une commande pleine largeur au bas de chaque carte : il pesait autant
// que le seuil qu'il supprime, et sur une liste de six seuils, six commandes de
// suppression occupaient plus de place que l'information. Il devient une croix au coin
// supérieur droit, à l'emplacement où l'on ferme une chose depuis toujours.
//
// La croix seule ne se prononce pas : le nom accessible dit ce qu'elle retire, et la
// confirmation qui suit rappelle le seuil concerné. Sa zone reste à 44 px.
function BoutonRetrait({ seuil, surRetrait }) {
  return (
    <button
      type="button"
      className="seuils__retrait"
      onClick={() => surRetrait(seuil)}
      aria-label={`Retirer ce seuil, ${nomCible(seuil)}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

export default function Seuils() {
  const { jeton } = useAuthentification();
  const naviguer = useNavigate();
  const seuilFeuille = useSeuil();
  // Le bouton flottant de la barre mobile ouvre la saisie d'un mouvement sur l'écran
  // courant plutôt que d'y renvoyer depuis le Patrimoine : cet écran doit donc héberger
  // la feuille, comme le font le tableau de bord, les positions et le détail.
  const mouvement = useMouvement();

  const [seuils, setSeuils] = useState(null);
  const [portefeuille, setPortefeuille] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [confirmation, setConfirmation] = useState(null);
  const [aRetirer, setARetirer] = useState(null);
  const [retraitEnCours, setRetraitEnCours] = useState(false);

  const [devise, setDevise] = useState(() => lirePreference(CLE_DEVISE, 'EUR'));
  const [masque, setMasque] = useState(() => lirePreference(CLE_MASQUAGE, 'non') === 'oui');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    try {
      // Le portefeuille sert à la fois à la feuille de création, qui a besoin des cours
      // et de la valeur totale, et à la bascule euro/dollar, qui a besoin du taux
      // d'affichage porté par cette même réponse (D69, D43) : son échec ne doit donc
      // pas priver l'écran de la liste des seuils, qui reste l'information principale.
      const [alertes, portefeuilleCourant] = await Promise.all([
        api.alertes(jeton),
        api.portefeuille(jeton).catch(() => null),
      ]);
      setSeuils(alertes);
      setPortefeuille(portefeuilleCourant);
    } catch (echec) {
      setErreur(echec);
    } finally {
      setChargement(false);
    }
  }, [jeton]);

  useEffect(() => {
    charger();
  }, [charger]);

  const visibles = useMemo(
    () => (seuils ?? []).filter((seuil) => STATUTS_AFFICHES.includes(seuil.statut)),
    [seuils]
  );
  const franchis = useMemo(() => visibles.filter((seuil) => seuil.statut === 'declenchee'), [visibles]);
  const enCours = useMemo(() => visibles.filter((seuil) => seuil.statut === 'active'), [visibles]);

  // Type de l'actif ciblé, pour le jeton de classe : l'alerte ne le porte pas
  // elle-même, seul le portefeuille le sait.
  const typeParActif = useMemo(() => {
    const table = new Map();
    for (const position of portefeuille?.actifs ?? []) {
      table.set(String(position.id), position.type);
    }
    return table;
  }, [portefeuille]);

  const taux = portefeuille?.taux_affichage?.eur_vers_usd ?? null;

  // Sans taux, afficher() rend déjà la valeur en euros (garde ci-dessous) : le symbole
  // montré doit retomber sur l'euro lui aussi, pour ne jamais écrire un montant en
  // euros avec un symbole dollar. Cas étroit (échec du taux avec une préférence déjà
  // en dollars) mais propre à cet écran, seul à survivre à l'échec du portefeuille.
  const deviseAffichee = taux ? devise : 'EUR';

  // Conversion à l'affichage seulement, comme sur les trois autres écrans : les
  // montants restent en euros dans les données, seule la présentation change (D43).
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

  async function confirmerRetrait() {
    setRetraitEnCours(true);
    try {
      await api.desactiverAlerte(jeton, aRetirer.id);
      setARetirer(null);
      await charger();
    } catch (echec) {
      setARetirer(null);
      setErreur(echec);
    } finally {
      setRetraitEnCours(false);
    }
  }

  function apresCreation({ resume }) {
    seuilFeuille.fermer();
    setConfirmation(resume);
    charger();
  }

  // Un mouvement change la valeur des positions et du patrimoine, donc l'écart restant
  // affiché devant chaque seuil : l'écran se recharge, le serveur restant seul à
  // recalculer. Aucun seuil n'est évalué pour autant — l'évaluation appartient à
  // l'actualisation du tableau de bord (D50).
  function apresMouvement({ resume }) {
    mouvement.fermer();
    setConfirmation(resume);
    charger();
  }

  const feuilleMouvement = mouvement.ouvert && (
    <FeuilleMouvement
      actifs={portefeuille?.actifs ?? []}
      actifInitialId={mouvement.actifInitialId}
      surFermeture={mouvement.fermer}
      surEnregistrement={apresMouvement}
    />
  );

  const feuille = seuilFeuille.ouvert && (
    <FeuilleSeuil
      actifs={portefeuille?.actifs ?? []}
      capitalTotal={portefeuille?.valeur_totale ?? '0'}
      cibleInitiale={seuilFeuille.cibleInitiale}
      surFermeture={seuilFeuille.fermer}
      surEnregistrement={apresCreation}
    />
  );

  if (chargement && !seuils) {
    return (
      <div className="seuils" aria-busy="true">
        <h1 className="seuils__titre">Seuils</h1>
        <p className="lecteur-ecran-seulement" role="status">
          Chargement des seuils.
        </p>
        <Squelette forme="bloc" />
        <Squelette forme="bloc" />
        <Squelette forme="bloc" />
      </div>
    );
  }

  if (erreur && !seuils) {
    const nature = natureDeLErreur(erreur);
    return (
      <div className="seuils">
        <h1 className="seuils__titre">Seuils</h1>
        <MessageErreur
          nature={nature}
          message={nature === 'api' ? erreur.message : undefined}
          libelleAction={nature === 'session' ? 'Se reconnecter' : 'Réessayer'}
          surAction={nature === 'session' ? () => naviguer('/connexion') : charger}
        />
      </div>
    );
  }

  if (visibles.length === 0) {
    return (
      <div className="seuils">
        <h1 className="seuils__titre">Seuils</h1>
        <EtatVide
          titre="Aucun seuil"
          explication="Posez un seuil sur un actif ou sur votre patrimoine total pour être prévenu sans avoir à consulter en permanence."
          libelleAction="Créer un seuil"
          surAction={() => seuilFeuille.ouvrir()}
        />
        {feuille}
        {feuilleMouvement}
      </div>
    );
  }

  return (
    <div className="seuils">
      <div className="seuils__entete">
        <h1 className="seuils__titre">Seuils</h1>
        <div className="seuils__outils">
          <Bouton onClick={() => seuilFeuille.ouvrir()}>+ Seuil</Bouton>
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

      {erreur && <MessageErreur nature={natureDeLErreur(erreur)} surAction={charger} />}

      {confirmation && <Message>{confirmation}</Message>}

      {franchis.length > 0 && (
        <section className="seuils__groupe" aria-labelledby="titre-seuils-franchis">
          <h2 id="titre-seuils-franchis" className="seuils__titre-groupe">
            Franchis
          </h2>
          <ul className="seuils__liste">
            {franchis.map((seuil) => {
              const type = typeParActif.get(String(seuil.actif_id));
              const date = formaterDate(seuil.date_declenchement);

              return (
                <li key={seuil.id}>
                  <Carte className="seuils__carte seuils__carte--franchi">
                    <div className="seuils__ligne">
                      {type && <JetonClasse classe={type} />}
                      <div className="seuils__intitule">
                        <p className="seuils__nom">
                          {nomCible(seuil)}{' '}
                          {seuil.sens_seuil === 'au_dessus' ? 'au-dessus de' : 'en dessous de'}{' '}
                          {masque ? (
                            <span aria-label="Montant masqué">••••</span>
                          ) : (
                            <Montant valeur={afficher(seuil.valeur_seuil)} devise={deviseAffichee} />
                          )}
                        </p>
                        <p className="seuils__sous-texte">
                          {date ? `Franchi le ${date}` : 'Franchi'}
                        </p>
                      </div>
                      <span className="seuils__puce-franchi">Franchi</span>
                      <BoutonRetrait seuil={seuil} surRetrait={setARetirer} />
                    </div>
                  </Carte>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {enCours.length > 0 && (
        <section className="seuils__groupe" aria-labelledby="titre-seuils-en-cours">
          <h2 id="titre-seuils-en-cours" className="seuils__titre-groupe">
            En cours
          </h2>
          <ul className="seuils__liste">
            {enCours.map((seuil) => {
              const type = typeParActif.get(String(seuil.actif_id));

              return (
                <li key={seuil.id}>
                  <Carte className="seuils__carte">
                    <div className="seuils__ligne">
                      {type && <JetonClasse classe={type} />}
                      <div className="seuils__intitule">
                        <p className="seuils__nom">
                          {nomCible(seuil)}{' '}
                          {seuil.sens_seuil === 'au_dessus' ? 'au-dessus de' : 'en dessous de'}{' '}
                          {masque ? (
                            <span aria-label="Montant masqué">••••</span>
                          ) : (
                            <Montant valeur={afficher(seuil.valeur_seuil)} devise={deviseAffichee} />
                          )}
                        </p>
                      </div>
                      <BoutonRetrait seuil={seuil} surRetrait={setARetirer} />
                    </div>

                    <BarreProgression
                      valeur={afficher(seuil.valeur_observee)}
                      cible={afficher(seuil.valeur_seuil)}
                      devise={deviseAffichee}
                      masque={masque}
                      sens={seuil.sens_seuil}
                      classe={type}
                      ecart={seuil.ecart_pourcentage}
                      libelle={`Progression vers le seuil, ${nomCible(seuil)}`}
                    />
                  </Carte>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {feuille}
      {feuilleMouvement}

      {aRetirer && (
        <Confirmation
          titre="Retirer ce seuil ?"
          // Le montant du seuil suit la même préférence de masquage que le reste de
          // l'écran : rien ne justifie qu'un dialogue de confirmation échappe à une
          // préférence qui s'applique partout ailleurs.
          consequence={
            <>
              Le seuil {nomCible(aRetirer)}{' '}
              {aRetirer.sens_seuil === 'au_dessus' ? 'au-dessus de' : 'en dessous de'}{' '}
              {masque ? (
                <span aria-label="Montant masqué">••••</span>
              ) : (
                formaterMontant(afficher(aRetirer.valeur_seuil), { symbole: symboleDevise(deviseAffichee) })
              )}{' '}
              ne surveillera plus rien. Vous pourrez en recréer un si besoin.
            </>
          }
          libelleConfirmation="Retirer le seuil"
          enCours={retraitEnCours}
          surConfirmation={confirmerRetrait}
          surAnnulation={() => setARetirer(null)}
        />
      )}
    </div>
  );
}
