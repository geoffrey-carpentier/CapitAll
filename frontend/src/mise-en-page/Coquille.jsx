import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import { useMouvement } from '../hooks/useMouvement';
import Bouton from '../composants/Bouton';
import Marque from '../composants/Marque';
import './Coquille.css';

// Navigation principale. Les écrans non encore développés figurent déjà dans la
// barre, désactivés : l'utilisateur voit où il ira, sans pouvoir atteindre une page
// vide. Leur indisponibilité est portée par l'attribut aria-disabled et par une
// mention textuelle, jamais par la seule couleur atténuée.
//
// Les libellés et les chemins suivent le lexique du projet : un même objet porte le
// même nom dans l'interface, dans le code et dans les routes. « Patrimoine » et non
// « tableau de bord », « Positions » et non « actifs », « Seuils » et non « alertes »,
// ce dernier terme étant réservé au franchissement d'un seuil.
//
// Le fil d'annonces ne figure plus ici : D64 l'a retiré de l'interface utilisateur, sa
// publication restant au périmètre de l'espace d'administration.
//
// Le bouton de saisie figure dans cette liste, à son rang. Il y était auparavant inséré
// sur un index dans la boucle de rendu : réordonner la barre l'aurait déplacé sans que
// rien ne le signale.
const ENTREES = [
  { chemin: '/patrimoine', libelle: 'Patrimoine', icone: 'patrimoine' },
  { chemin: '/positions', libelle: 'Positions', icone: 'positions' },
  { action: 'mouvement' },
  { chemin: '/seuils', libelle: 'Seuils', icone: 'seuils' },
  { chemin: '/compte', libelle: 'Compte', icone: 'compte' },
];

// Écrans qui hébergent la feuille de saisie d'un mouvement.
//
// Le bouton flottant y ouvre la saisie sur place, par-dessus l'écran courant, au lieu de
// renvoyer systématiquement au Patrimoine : quitter l'écran qu'on consultait pour
// enregistrer un mouvement fait perdre son filtre, son tri et sa position de lecture.
//
// L'écran Compte n'affiche aucune position et n'héberge pas la feuille : le bouton y
// reste une navigation, visible et assumée. L'alternative aurait été de changer l'action
// selon l'écran — « + Seuil » sur les seuils, par exemple. Un même bouton, au même
// endroit, faisant deux choses différentes selon la page, se retient mal et se découvre
// par erreur.
const ECRANS_AVEC_SAISIE = ['/patrimoine', '/positions', '/seuils'];

function IconeNavigation({ nom }) {
  const chemins = {
    patrimoine: <><path d="M4 7h16v12H4z" /><path d="M4 10h16M16 14h2" /></>,
    positions: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    seuils: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2v3M22 12h-3" /></>,
    compte: <><circle cx="12" cy="8" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
  };

  return (
    <svg className="coquille__icone" viewBox="0 0 24 24" aria-hidden="true">
      {chemins[nom]}
    </svg>
  );
}

export default function Coquille() {
  const { utilisateur, deconnecter } = useAuthentification();

  return (
    <div className="coquille">
      <nav className="coquille__navigation" aria-label="Navigation principale">
        <p className="coquille__marque"><Marque />WalletWatch</p>

        <ul className="coquille__liste">
          {ENTREES.map((entree) =>
            entree.action ? (
              <ActionMouvement key="action-mouvement" />
            ) : (
              <EntreeNavigation key={entree.chemin} entree={entree} />
            )
          )}
        </ul>

        <div className="coquille__pied">
          {utilisateur && <p className="coquille__pseudo">Session ouverte<br />{utilisateur.pseudo}</p>}
          <Bouton variante="secondaire" onClick={deconnecter}>
            Se déconnecter
          </Bouton>
        </div>
      </nav>

      <main className="coquille__contenu">
        <Outlet />
      </main>
    </div>
  );
}

function EntreeNavigation({ entree }) {
  return (
    <li>
      <NavLink
        to={entree.chemin}
        className={({ isActive }) => `coquille__lien${isActive ? ' coquille__lien--actif' : ''}`}
      >
        <IconeNavigation nom={entree.icone} />
        <span className="coquille__libelle">{entree.libelle}</span>
      </NavLink>
    </li>
  );
}

// Bouton de saisie de la barre mobile.
//
// Sur un écran qui héberge la feuille, c'est un bouton : il ajoute le paramètre
// d'ouverture à l'adresse courante, la feuille s'ouvre par-dessus, l'écran reste. Ailleurs
// c'est un lien, parce que l'action est alors une navigation et que l'utilisateur doit
// pouvoir le voir avant de cliquer, comme n'importe quel lien de la barre.
function ActionMouvement() {
  const { pathname } = useLocation();
  const { ouvrir } = useMouvement();

  const contenu = (
    <>
      <span className="coquille__ajout-symbole" aria-hidden="true">+</span>
      <span className="lecteur-ecran-seulement">Nouveau mouvement</span>
    </>
  );

  if (!ECRANS_AVEC_SAISIE.some((chemin) => pathname.startsWith(chemin))) {
    return (
      <li className="coquille__action-mobile">
        <NavLink to="/patrimoine?mouvement=nouveau" className="coquille__ajout">
          {contenu}
        </NavLink>
      </li>
    );
  }

  return (
    <li className="coquille__action-mobile">
      <button type="button" className="coquille__ajout" onClick={() => ouvrir()}>
        {contenu}
      </button>
    </li>
  );
}
