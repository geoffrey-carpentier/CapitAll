import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FournisseurAuthentification } from './contexte/Authentification';
import RouteProtegee from './composants/RouteProtegee';
import Coquille from './mise-en-page/Coquille';
import Connexion from './pages/Connexion';
import Inscription from './pages/Inscription';
import Patrimoine from './pages/Patrimoine';
import Positions from './pages/Positions';
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
          </Route>

          <Route path="/" element={<Navigate to="/patrimoine" replace />} />
          <Route path="*" element={<Introuvable />} />
        </Routes>
      </FournisseurAuthentification>
    </BrowserRouter>
  );
}
