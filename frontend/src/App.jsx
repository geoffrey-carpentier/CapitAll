import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FournisseurAuthentification } from './contexte/Authentification';
import RouteProtegee from './composants/RouteProtegee';
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
          </Route>

          <Route path="/" element={<Navigate to="/patrimoine" replace />} />
          <Route path="*" element={<Introuvable />} />
        </Routes>
      </FournisseurAuthentification>
    </BrowserRouter>
  );
}
