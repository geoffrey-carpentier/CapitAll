// Mise en forme des dates et durées, séparée de formatage.js qui ne traite que des
// valeurs financières transmises en chaîne.

const MINUTE = 60 * 1000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

// Date et heure absolues, pour un relevé historique (formaterAnciennete sert à la
// fraîcheur d'un cours).
export function formaterInstant(horodatage) {
  if (!horodatage) {
    return null;
  }

  const instant = new Date(horodatage);

  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  return instant.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Ancienneté relative. L'instant courant est un paramètre pour tester sans figer
// l'horloge.
export function formaterAnciennete(horodatage, maintenant = new Date()) {
  if (!horodatage) {
    return null;
  }

  const instant = new Date(horodatage);

  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const ecart = maintenant.getTime() - instant.getTime();

  // Un écart négatif (horloge client en avance) est traité comme frais.
  if (ecart < MINUTE) {
    return "à l'instant";
  }

  if (ecart < HEURE) {
    return `il y a ${Math.floor(ecart / MINUTE)} min`;
  }

  if (ecart < JOUR) {
    return `il y a ${Math.floor(ecart / HEURE)} h`;
  }

  const jours = Math.floor(ecart / JOUR);
  return `il y a ${jours} j`;
}
