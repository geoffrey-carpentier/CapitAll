import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { useMouvement } from '../hooks/useMouvement';
import { api, ErreurApi } from '../services/api';
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
import Message from '../composants/Message';
import { lirePreference, ecrirePreference, CLE_DEVISE, CLE_MASQUAGE } from '../utils/preferences';
import './Positions.css';

// Écran Positions.
//
// Vue exhaustive et comparable de ce qui est détenu. Il consomme la même réponse que le
// tableau de bord : `GET /api/portefeuille` renvoie déjà chaque position valorisée, avec
// son cours, son prix de revient, sa valeur et sa plus-value. Aucune de ces valeurs
// n'est recalculée ici, conformément à la règle de répartition du calcul (D69).
//
// Le tri et le filtrage sont, eux, de la présentation : ils ne créent aucun fait
// nouveau. Le tri passe malgré tout par le comparateur exact du module de formatage,
// parce que comparer deux montants convertis en nombres rouvrirait la porte au flottant
// que toute la chaîne s'emploie à tenir fermée.

// Colonnes triables, et leur libellé pour le menu de tri du mobile. Les en-têtes du
// tableau desktop reprennent ces mêmes libellés : deux listes divergeraient.
const TRIS = [
  { cle: 'valeur', libelle: 'Valorisation' },
  { cle: 'plus_value_latente', libelle: 'Plus-value' },
  { cle: 'quantite_detenue', libelle: 'Quantité' },
  { cle: 'cours_eur', libelle: 'Cours' },
  { cle: 'pru', libelle: 'Prix de revient' },
  // La tendance sur trente jours n'existe que dans le tableau desktop : la liste
  // mobile ne l'affiche pas, et proposer de trier sur une colonne invisible rendrait
  // l'ordre de la liste inexplicable. Elle reste triable par son en-tête de colonne,
  // et donc admise dans l'adresse.
  { cle: 'tendance', libelle: '30 jours', surMobile: false },
];

const TRIS_AUTORISES = TRIS.map((option) => option.cle);

// Le tri porte sur des chaînes de montants. Toutes se lisent directement sur la
// position, sauf la tendance, qui est un objet : son accès est décrit ici plutôt que
// dans le comparateur, qui n'a pas à connaître la forme de la réponse.
const VALEURS_DE_TRI = {
  tendance: (position) => position.tendance_30j?.variation ?? null,
};

function valeurDeTri(position, cle) {
  return (VALEURS_DE_TRI[cle] ?? ((ligne) => ligne[cle]))(position);
}

// Tri par défaut : la valorisation décroissante. C'est l'ordre qui répond à la question
// posée en arrivant sur l'écran, « qu'est-ce qui pèse le plus ».
const TRI_PAR_DEFAUT = { cle: 'valeur', descendant: true };

function natureDeLErreur(erreur) {
  if (!(erreur instanceof ErreurApi)) {
    return 'api';
  }
  if (erreur.statut === 0) {
    return 'reseau';
  }
  return erreur.statut === 401 ? 'session' : 'api';
}

export default function Positions() {
  const { jeton } = useAuthentification();
  const naviguer = useNavigate();
  const [parametres, setParametres] = useSearchParams();

  const [portefeuille, setPortefeuille] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [confirmation, setConfirmation] = useState(null);

  const mouvement = useMouvement();

  const [devise, setDevise] = useState(() => lirePreference(CLE_DEVISE, 'EUR'));
  const [masque, setMasque] = useState(() => lirePreference(CLE_MASQUAGE, 'non') === 'oui');

  // Filtres et tri vivent dans l'URL, pas dans l'état du composant : une liste filtrée
  // se partage par son adresse et survit à un rechargement. Les valeurs reçues sont
  // filtrées contre les listes autorisées, une adresse pouvant être bricolée à la main.
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

  // Les positions sont converties une fois, ici, puis descendues telles quelles : la
  // liste n'a pas à savoir quelle devise est affichée pour mettre en forme un montant.
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
    // Cliquer la colonne déjà triée inverse le sens ; cliquer une autre colonne la trie
    // d'abord en décroissant, l'intérêt étant presque toujours de voir les plus grandes
    // valeurs en premier.
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

  // Le mouvement change la position, son prix de revient et sa valorisation : l'écran se
  // recharge, le serveur restant seul à recalculer.
  function apresEnregistrement({ resume }) {
    mouvement.fermer();
    setConfirmation(resume);
    charger();
  }

  // La feuille reçoit les positions telles que le serveur les a rendues, en euros, et
  // non celles converties pour l'affichage : la saisie se fait dans la devise de
  // référence, et un prix pré-rempli en dollars serait enregistré comme des euros.
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
        {/* Le squelette reprend la forme d'une liste de lignes, pas celle d'un bloc. */}
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
    const nature = natureDeLErreur(erreur);

    return (
      <div className="positions">
        <h1 className="positions__titre">Positions</h1>
        <MessageErreur
          nature={nature}
          message={nature === 'api' ? erreur.message : undefined}
          libelleAction={nature === 'session' ? 'Se reconnecter' : 'Réessayer'}
          surAction={nature === 'session' ? () => naviguer('/connexion') : charger}
        />
      </div>
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
        <MessageErreur nature={natureDeLErreur(erreur)} surAction={charger} />
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

        {/* Le tri par en-tête de colonne n'existe qu'en desktop : sous le point de
            rupture, la liste n'a pas de colonnes à cliquer. Ce menu le remplace, et
            reste dans le document en desktop sans être affiché. */}
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

      {/* Absence de données après filtrage : l'en-tête et les filtres restent affichés,
          seul le contenu de la liste change. C'est un résultat de recherche vide, pas un
          portefeuille vide, et les deux ne se disent pas de la même façon. */}
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
