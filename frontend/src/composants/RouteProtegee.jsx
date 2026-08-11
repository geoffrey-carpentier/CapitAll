// Garde de routes : sans jeton, l'accès est renvoyé vers la connexion.
//
// La route demandée est mémorisée dans l'état de navigation, ce qui permet d'y
// revenir une fois connecté plutôt que d'atterrir systématiquement sur le tableau de
// bord. C'est aussi ce qui se produit lorsqu'un jeton expire en cours de session.

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
