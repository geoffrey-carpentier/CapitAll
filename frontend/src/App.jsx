import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FournisseurAuthentification } from './contexte/Authentification';
import RouteProtegee from './composants/RouteProtegee';
import MotDePasseOublie from './pages/MotDePasseOublie';
import Reinitialisation from './pages/Reinitialisation';
import Coquille from './mise-en-page/Coquille';
import Connexion from './pages/Connexion';
import Inscription from './pages/Inscription';
import Patrimoine from './pages/Patrimoine';
import Positions from './pages/Positions';
import DetailPosition from './pages/DetailPosition';
import Seuils from './pages/Seuils';
import Compte from './pages/Compte';
import Introuvable from './pages/Introuvable';

export default function App() {
  return (
    <BrowserRouter>
      <FournisseurAuthentification>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/inscription" element={<Inscription />} />
          {/* Récupération d'un mot de passe oublié (D23) : deux écrans publics, la
              demande d'une clé puis le choix du nouveau mot de passe. */}
          <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="/reinitialisation" element={<Reinitialisation />} />

          {/* Les écrans authentifiés partagent la même coquille de navigation. */}
          <Route
            element={
              <RouteProtegee>
                <Coquille />
              </RouteProtegee>
            }
          >
            <Route path="/patrimoine" element={<Patrimoine />} />
            <Route path="/positions" element={<Positions />} />
            <Route path="/positions/:id" element={<DetailPosition />} />
            <Route path="/seuils" element={<Seuils />} />
            <Route path="/compte" element={<Compte />} />

            {/* La saisie d'un mouvement est une feuille posée sur l'écran d'origine, et
                non une page : elle n'a pas de route à elle. L'adresse reste toutefois
                atteignable, et ouvre la feuille par-dessus le patrimoine. */}
            <Route
              path="/mouvement"
              element={<Navigate to="/patrimoine?mouvement=nouveau" replace />}
            />

            {/* L'adresse inconnue reste dans la coquille : l'utilisateur garde sa
                navigation et repart d'un clic, au lieu d'être déposé sur une page nue
                qui a l'air d'appartenir à un autre site. Aucun contenu n'étant public,
                un visiteur non connecté est conduit à la connexion par la route
                protégée, ce qui est le même parcours que pour toute autre adresse. */}
            <Route path="*" element={<Introuvable />} />
          </Route>

          <Route path="/" element={<Navigate to="/patrimoine" replace />} />
        </Routes>
      </FournisseurAuthentification>
    </BrowserRouter>
  );
}
