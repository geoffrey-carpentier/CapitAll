import { NavLink, Outlet } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import Bouton from '../composants/Bouton';
import './Coquille.css';

// Navigation principale. Les écrans non encore développés figurent déjà dans la
// barre, désactivés : l'utilisateur voit où il ira, sans pouvoir atteindre une page
// vide. Leur indisponibilité est portée par l'attribut aria-disabled et par une
// mention textuelle, jamais par la seule couleur atténuée.
const ENTREES = [
  { chemin: '/tableau-de-bord', libelle: 'Tableau de bord', symbole: '◫', disponible: true },
  { chemin: '/actifs', libelle: 'Actifs', symbole: '◈', disponible: false },
  { chemin: '/alertes', libelle: 'Alertes', symbole: '△', disponible: false },
  { chemin: '/annonces', libelle: 'Annonces', symbole: '✉', disponible: false },
  { chemin: '/compte', libelle: 'Compte', symbole: '◉', disponible: false },
];

export default function Coquille() {
  const { utilisateur, deconnecter } = useAuthentification();

  return (
    <div className="coquille">
      <nav className="coquille__navigation" aria-label="Navigation principale">
        <p className="coquille__marque">CapitAll</p>

        <ul className="coquille__liste">
          {ENTREES.map((entree) => (
            <li key={entree.chemin}>
              {entree.disponible ? (
                <NavLink
                  to={entree.chemin}
                  className={({ isActive }) =>
                    `coquille__lien${isActive ? ' coquille__lien--actif' : ''}`
                  }
                >
                  <span className="coquille__symbole" aria-hidden="true">
                    {entree.symbole}
                  </span>
                  <span className="coquille__libelle">{entree.libelle}</span>
                </NavLink>
              ) : (
                <span className="coquille__lien coquille__lien--indisponible" aria-disabled="true">
                  <span className="coquille__symbole" aria-hidden="true">
                    {entree.symbole}
                  </span>
                  <span className="coquille__libelle">{entree.libelle}</span>
                  <span className="lecteur-ecran-seulement"> (bientôt disponible)</span>
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="coquille__pied">
          {utilisateur && <p className="coquille__pseudo">{utilisateur.pseudo}</p>}
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
