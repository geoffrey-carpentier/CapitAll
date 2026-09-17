// Garde de routes : sans session, redirection vers la connexion. Le chemin demandé est
// mémorisé pour y revenir après connexion, y compris après une expiration.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';

export default function RouteProtegee({ children }) {
  const { estConnecte } = useAuthentification();
  const emplacement = useLocation();

  if (!estConnecte) {
    return <Navigate to="/connexion" replace state={{ depuis: emplacement.pathname }} />;
  }

  return children;
}
