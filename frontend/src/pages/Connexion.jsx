import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthentification } from '../contexte/contexteAuthentification';
import Bouton from '../composants/Bouton';
import Champ from '../composants/Champ';
import Message from '../composants/Message';
import './Authentification.css';
import Marque from '../composants/Marque';

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

  // Message transmis par l'écran précédent, par exemple après suppression du compte.
  const messageArrivee = emplacement.state?.message ?? null;

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
      // Message générique du serveur, repris tel quel : il ne doit pas distinguer une
      // adresse inconnue d'un mauvais mot de passe.
      setErreur(echec.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main className="authentification">
      <div className="authentification__carte">
        <p className="authentification__marque">
          <Marque taille={28} />
          WalletWatch
        </p>
        <h1 className="authentification__titre">Connexion</h1>
        <p className="authentification__intro">Accédez au suivi de votre patrimoine.</p>

        {/* Une session close (expiration, compte désactivé, mot de passe changé
            ailleurs) ramène ici avec une explication. */}
        {messageArrivee && <Message variante="information">{messageArrivee}</Message>}
        {sessionExpiree && !erreur && !messageArrivee && (
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
          <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </p>

        <p className="authentification__bascule">
          Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      </div>
    </main>
  );
}
