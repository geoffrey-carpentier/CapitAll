import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import Bouton from '../composants/Bouton';
import Champ from '../composants/Champ';
import Message from '../composants/Message';
import './Authentification.css';

// Demande de réinitialisation d'un mot de passe oublié (D23).
//
// D23 laisse à l'administrateur un privilège minimal et lui interdit d'accéder aux
// données d'autrui : réinitialiser le mot de passe d'un tiers reviendrait à lui donner
// les clés d'un portefeuille. La récupération appartient donc à l'utilisateur seul.
//
// L'écran affiche toujours le même message, que l'adresse corresponde ou non à un
// compte. C'est ce qui interdit de s'en servir pour découvrir qui est inscrit, et c'est
// pour cela que le formulaire disparaît après l'envoi : le laisser en place inviterait à
// réessayer une autre adresse pour comparer les réponses.

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
        <h1 className="authentification__titre">Mot de passe oublié</h1>
        <p className="authentification__intro">
          Indiquez l’adresse de votre compte. Vous recevrez une clé permettant d’en choisir un
          nouveau.
        </p>

        {erreur && <Message variante="erreur">{erreur}</Message>}

        {reponse ? (
          <>
            <Message variante="information">{reponse.message}</Message>

            {/* Le projet n'envoie pas de courriel : aucun service d'envoi n'est au
                périmètre. La clé est donc affichée, pour que le parcours soit
                démontrable de bout en bout.

                Cette commodité est fermée par défaut côté serveur et n'a rien à faire
                sur un déploiement réel : une clé qui n'apparaît que si l'adresse existe
                révèle l'existence du compte. Le dire à l'écran vaut mieux que de le
                laisser découvrir. */}
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
