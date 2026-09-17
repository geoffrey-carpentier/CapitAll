import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { useMouvement } from '../hooks/useMouvement';
import { api } from '../services/api';
import { classifierErreurApi } from '../utils/erreurs';
import { convertir } from '../utils/conversion';
import { comparerDecimales, CLASSES_QUANTITE } from '../utils/formatage';
import Bouton from '../composants/Bouton';
import FeuilleMouvement from '../composants/FeuilleMouvement';
import TableauPositions from '../composants/TableauPositions';
import FiltresClasse from '../composants/FiltresClasse';
import BasculeDevise from '../composants/BasculeDevise';
import MasquageMontants from '../composants/MasquageMontants';
import EtatVide from '../composants/EtatVide';
import Squelette from '../composants/Squelette';
import MessageErreur from '../composants/MessageErreur';
import ErreurChargementPage from '../composants/ErreurChargementPage';
import Message from '../composants/Message';
import { lirePreference, ecrirePreference, CLE_DEVISE, CLE_MASQUAGE } from '../utils/preferences';
import './Positions.css';

// Écran Positions : liste de toutes les positions, valorisées par
// `GET /api/portefeuille`. Rien n'est recalculé ici ; le tri, simple présentation, passe
// par le comparateur exact du module de formatage.

// Colonnes triables. Le menu mobile et les en-têtes du tableau partagent ces libellés.
const TRIS = [
  { cle: 'valeur', libelle: 'Valorisation' },
  { cle: 'plus_value_latente', libelle: 'Plus-value' },
  { cle: 'quantite_detenue', libelle: 'Quantité' },
  { cle: 'cours_eur', libelle: 'Cours' },
  { cle: 'pru', libelle: 'Prix de revient' },
  // Absente de la liste mobile, donc de son menu de tri ; triable en desktop.
  { cle: 'tendance', libelle: '30 jours', surMobile: false },
];

const TRIS_AUTORISES = TRIS.map((option) => option.cle);

// Accès aux valeurs de tri qui ne sont pas une propriété directe de la position.
const VALEURS_DE_TRI = {
  tendance: (position) => position.tendance_30j?.variation ?? null,
};

function valeurDeTri(position, cle) {
  return (VALEURS_DE_TRI[cle] ?? ((ligne) => ligne[cle]))(position);
}

const TRI_PAR_DEFAUT = { cle: 'valeur', descendant: true };

export default function Positions() {
  const { jeton } = useAuthentification();
  const [parametres, setParametres] = useSearchParams();

  const [portefeuille, setPortefeuille] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [confirmation, setConfirmation] = useState(null);

  const mouvement = useMouvement();

  const [devise, setDevise] = useState(() => lirePreference(CLE_DEVISE, 'EUR'));
  const [masque, setMasque] = useState(() => lirePreference(CLE_MASQUAGE, 'non') === 'oui');

  // Filtres et tri vivent dans l'adresse, pour survivre à un rechargement. Les valeurs
  // sont validées contre les listes autorisées, l'adresse pouvant être modifiée à la main.
  const classesFiltrees = useMemo(
    () => (parametres.get('classes') ?? '').split(',').filter((c) => CLASSES_QUANTITE.includes(c)),
    [parametres]
  );

  const tri = useMemo(() => {
    const cle = parametres.get('tri');
    if (!TRIS_AUTORISES.includes(cle)) {
      return TRI_PAR_DEFAUT;
    }
    return { cle, descendant: parametres.get('sens') !== 'asc' };
  }, [parametres]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    try {
      setPortefeuille(await api.portefeuille(jeton));
    } catch (echec) {
      setErreur(echec);
    } finally {
      setChargement(false);
    }
  }, [jeton]);

  useEffect(() => {
    charger();
  }, [charger]);

  const taux = portefeuille?.taux_affichage?.eur_vers_usd ?? null;

  const afficher = useCallback(
    (montant) => {
      if (montant === null || montant === undefined) {
        return null;
      }
      if (devise === 'EUR' || !taux) {
        return montant;
      }
      return convertir(montant, taux);
    },
    [devise, taux]
  );

  // Conversion unique ici : le tableau n'a pas à connaître la devise affichée.
  const positions = useMemo(() => {
    const brutes = portefeuille?.actifs ?? [];

    return brutes.map((position) => ({
      ...position,
      cours_eur: afficher(position.cours_eur),
      pru: afficher(position.pru),
      valeur: afficher(position.valeur),
      plus_value_latente: afficher(position.plus_value_latente),
    }));
  }, [portefeuille, afficher]);

  const visibles = useMemo(() => {
    const retenues =
      classesFiltrees.length === 0
        ? positions
        : positions.filter((position) => classesFiltrees.includes(position.type));

    return [...retenues].sort((a, b) =>
      comparerDecimales(valeurDeTri(a, tri.cle), valeurDeTri(b, tri.cle), {
        descendant: tri.descendant,
      })
    );
  }, [positions, classesFiltrees, tri]);

  function basculerClasse(classe) {
    const suivantes = classesFiltrees.includes(classe)
      ? classesFiltrees.filter((c) => c !== classe)
      : [...classesFiltrees, classe];

    modifierParametres({ classes: suivantes.join(',') });
  }

  function changerTri(cle) {
    // Même colonne : inversion du sens ; nouvelle colonne : décroissant d'abord.
    const descendant = tri.cle === cle ? !tri.descendant : true;
    modifierParametres({ tri: cle, sens: descendant ? 'desc' : 'asc' });
  }

  function modifierParametres(modifications) {
    const suivants = new URLSearchParams(parametres);

    Object.entries(modifications).forEach(([cle, valeur]) => {
      if (valeur) {
        suivants.set(cle, valeur);
      } else {
        suivants.delete(cle);
      }
    });

    setParametres(suivants, { replace: true });
  }

  // Le serveur recalcule tout après un mouvement : l'écran se recharge.
  function apresEnregistrement({ resume }) {
    mouvement.fermer();
    setConfirmation(resume);
    charger();
  }

  // La feuille reçoit les positions en euros : un prix pré-rempli en dollars serait
  // enregistré comme des euros.
  const feuille = mouvement.ouvert && (
    <FeuilleMouvement
      actifs={portefeuille?.actifs ?? []}
      actifInitialId={mouvement.actifInitialId}
      surFermeture={mouvement.fermer}
      surEnregistrement={apresEnregistrement}
    />
  );

  const outils = (
    <div className="positions__outils">
      <Bouton onClick={() => mouvement.ouvrir()}>+ Mouvement</Bouton>
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

  if (chargement && !portefeuille) {
    return (
      <div className="positions" aria-busy="true">
        <h1 className="positions__titre">Positions</h1>
        <p className="lecteur-ecran-seulement" role="status">
          Chargement des positions.
        </p>
        <div className="positions__squelette">
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
          <Squelette forme="ligne" />
        </div>
      </div>
    );
  }

  if (erreur && !portefeuille) {
    return (
      <ErreurChargementPage
        page="positions"
        titre="Positions"
        erreur={erreur}
        surReessayer={charger}
      />
    );
  }

  if (positions.length === 0) {
    return (
      <div className="positions">
        <h1 className="positions__titre">Positions</h1>
        <EtatVide
          titre="Aucune position"
          explication="Votre portefeuille ne contient aucune position. Enregistrez un achat pour la voir apparaître ici."
          libelleAction="Ajouter une position"
          surAction={() => mouvement.ouvrir()}
        />
        {feuille}
      </div>
    );
  }

  const enRepli = positions.filter((position) => position.source_cours === 'repli');
  const sansCours = portefeuille.cours_indisponibles ?? [];

  return (
    <div className="positions">
      <div className="positions__entete">
        <h1 className="positions__titre">
          Positions <span className="positions__compte">{visibles.length}</span>
        </h1>
        {outils}
      </div>

      {erreur && (
        <MessageErreur nature={classifierErreurApi(erreur)} surAction={charger} />
      )}

      {confirmation && <Message>{confirmation}</Message>}

      {enRepli.length > 0 && (
        <Message variante="avertissement">
          Cours momentanément indisponible pour {enRepli.map((p) => p.symbole).join(', ')}. La
          valorisation de ces positions utilise le dernier cours connu.
        </Message>
      )}

      {sansCours.length > 0 && (
        <Message variante="avertissement">
          Aucun cours disponible pour {sansCours.join(', ')} : ces positions ne sont pas
          valorisées.
        </Message>
      )}

      <div className="positions__commandes">
        <FiltresClasse
          positions={positions}
          actives={classesFiltrees}
          surBascule={basculerClasse}
        />

        {/* Menu de tri mobile, qui remplace le tri par en-tête de colonne ; masqué en
            desktop par le CSS. */}
        <div className="positions__tri-mobile">
          <label htmlFor="tri-positions">Trier par</label>
          <select
            id="tri-positions"
            value={`${tri.cle}:${tri.descendant ? 'desc' : 'asc'}`}
            onChange={(evenement) => {
              const [cle, sens] = evenement.target.value.split(':');
              modifierParametres({ tri: cle, sens });
            }}
          >
            {TRIS.filter((option) => option.surMobile !== false).map((option) => (
              <optgroup key={option.cle} label={option.libelle}>
                <option value={`${option.cle}:desc`}>{option.libelle}, décroissant</option>
                <option value={`${option.cle}:asc`}>{option.libelle}, croissant</option>
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Filtre sans résultat, distinct d'un portefeuille vide : les filtres restent
          affichés. */}
      {visibles.length === 0 ? (
        <div className="positions__sans-resultat" role="status">
          <p>Aucune position ne correspond aux classes sélectionnées.</p>
          <Bouton
            type="button"
            variante="secondaire"
            onClick={() => modifierParametres({ classes: '' })}
          >
            Réinitialiser les filtres
          </Bouton>
        </div>
      ) : (
        <TableauPositions
          positions={visibles}
          devise={devise}
          masque={masque}
          tri={tri}
          surTri={changerTri}
        />
      )}

      {feuille}
    </div>
  );
}
