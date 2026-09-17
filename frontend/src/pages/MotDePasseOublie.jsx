import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import Bouton from '../composants/Bouton';
import Champ from '../composants/Champ';
import Message from '../composants/Message';
import './Authentification.css';
import Marque from '../composants/Marque';

// Demande de réinitialisation d'un mot de passe oublié, par l'utilisateur lui-même :
// l'administrateur n'a pas accès aux comptes d'autrui.
//
// Le message est identique que l'adresse existe ou non, pour ne pas révéler qui est
// inscrit, et le formulaire disparaît après l'envoi pour ne pas inviter à comparer.

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [reponse, setReponse] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      setReponse(await api.demanderRecuperation({ email }));
    } catch (echec) {
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
        <h1 className="authentification__titre">Mot de passe oublié</h1>
        <p className="authentification__intro">
          Indiquez l’adresse de votre compte. Vous recevrez une clé permettant d’en choisir un
          nouveau.
        </p>

        {erreur && <Message variante="erreur">{erreur}</Message>}

        {reponse ? (
          <>
            <Message variante="information">{reponse.message}</Message>

            {/* Sans envoi de courriel, la clé est affichée pour la démonstration. Désactivé
                par défaut côté serveur : en production, cet affichage révélerait
                l'existence du compte. */}
            {reponse.jeton && (
              <div className="authentification__cle">
                <p className="authentification__cle-titre">
                  <span aria-hidden="true">◐ </span>
                  Mode démonstration : la clé est affichée ici au lieu d’être envoyée par
                  courriel.
                </p>
                <code className="authentification__cle-valeur">{reponse.jeton}</code>
                <p className="authentification__cle-note">
                  Valable une heure, et une seule fois.
                </p>
              </div>
            )}

            <p className="authentification__bascule">
              <Link
                to={
                  reponse.jeton
                    ? `/reinitialisation?jeton=${encodeURIComponent(reponse.jeton)}`
                    : '/reinitialisation'
                }
              >
                Choisir un nouveau mot de passe
              </Link>
            </p>
          </>
        ) : (
          <form onSubmit={soumettre} noValidate>
            <Champ
              label="Adresse électronique"
              type="email"
              autoComplete="email"
              valeur={email}
              onChange={(evenement) => setEmail(evenement.target.value)}
              obligatoire
            />

            <Bouton type="submit" enCours={enCours}>
              Demander une clé
            </Bouton>
          </form>
        )}

        <p className="authentification__bascule">
          <Link to="/connexion">Revenir à la connexion</Link>
        </p>
      </div>
    </main>
  );
}
