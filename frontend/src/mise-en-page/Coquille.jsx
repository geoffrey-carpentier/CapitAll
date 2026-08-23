import { NavLink, Outlet } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import Bouton from '../composants/Bouton';
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
const ENTREES = [
  { chemin: '/patrimoine', libelle: 'Patrimoine', symbole: '◫', disponible: true },
  { chemin: '/positions', libelle: 'Positions', symbole: '◈', disponible: false },
  { chemin: '/seuils', libelle: 'Seuils', symbole: '△', disponible: false },
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
