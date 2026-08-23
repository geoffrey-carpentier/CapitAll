import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import Bouton from '../composants/Bouton';
import Champ from '../composants/Champ';
import Message from '../composants/Message';
import './Authentification.css';

export default function Connexion() {
  const { connecter, estConnecte, sessionExpiree } = useAuthentification();
  const naviguer = useNavigate();
  const emplacement = useLocation();

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  // Route demandée avant la redirection vers la connexion, le cas échéant.
  const destination = emplacement.state?.depuis ?? '/patrimoine';

  if (estConnecte) {
    return <Navigate to={destination} replace />;
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      await connecter({ email, motDePasse });
      naviguer(destination, { replace: true });
    } catch (echec) {
      // Le message du serveur est repris tel quel. Il est volontairement générique et
      // ne distingue jamais l'adresse du mot de passe : le reformuler ici, ou tenter
      // de préciser la cause, annulerait cette protection.
      setErreur(echec.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main className="authentification">
      <div className="authentification__carte">
        <h1 className="authentification__titre">Connexion</h1>
        <p className="authentification__intro">Accédez au suivi de votre patrimoine.</p>

        {/* Le jeton ne vit qu'en mémoire : une session expirée ramène ici. Le dire
            explicitement évite que la reconnexion passe pour une anomalie. */}
        {sessionExpiree && !erreur && (
          <Message variante="information">
            Votre session a expiré. Reconnectez-vous pour retrouver vos données.
          </Message>
        )}
        {erreur && <Message variante="erreur">{erreur}</Message>}

        <form onSubmit={soumettre} noValidate>
          <Champ
            label="Adresse électronique"
            type="email"
            autoComplete="email"
            valeur={email}
            onChange={(e) => setEmail(e.target.value)}
            obligatoire
          />

          <Champ
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            valeur={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            obligatoire
          />

          <Bouton type="submit" enCours={enCours}>
            Se connecter
          </Bouton>
        </form>

        <p className="authentification__bascule">
          Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      </div>
    </main>
  );
}
