export const metadata = { title: 'CGV — Multiwex' };

export default function CgvPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="section-title mb-4">Conditions Générales de Vente</h1>
      <div className="space-y-4 text-sm text-white/70">
        <p className="rounded-xl border border-mw-yellow/30 bg-mw-yellow/5 p-4 text-mw-yellow">
          ⚠ Page placeholder — le texte définitif des CGV Multiwex doit être rédigé avec un juriste avant la mise en production.
        </p>
        <h2 className="display mt-6 text-xl text-white">1. Objet</h2>
        <p>Les présentes CGV régissent les réservations effectuées via multiwex.be ou son module de réservation en ligne.</p>
        <h2 className="display mt-6 text-xl text-white">2. Prix et paiement</h2>
        <p>Les prix affichés sont en euros, TVA comprise. Le paiement est exigible au moment de la réservation. Aucune réservation n'est confirmée tant que le paiement n'a pas été validé.</p>
        <h2 className="display mt-6 text-xl text-white">3. Annulation et remboursement</h2>
        <p><strong className="text-white">Aucun remboursement n'est possible</strong> une fois la réservation confirmée. Les réservations peuvent être modifiées jusqu'à 24h avant le créneau, uniquement pour ajouter des joueurs supplémentaires.</p>
        <h2 className="display mt-6 text-xl text-white">4. Restrictions et sécurité</h2>
        <p>Chaque activité est soumise à des restrictions d'âge, de taille ou de santé. Le client déclare avoir pris connaissance des restrictions et garantit que tous les participants y répondent. Multiwex se réserve le droit de refuser l'accès à un participant ne respectant pas les conditions.</p>
        <h2 className="display mt-6 text-xl text-white">5. Responsabilité</h2>
        <p>Les participants évoluent sous leur propre responsabilité. Multiwex décline toute responsabilité en cas de dommage résultant du non-respect des consignes de sécurité.</p>
        <h2 className="display mt-6 text-xl text-white">6. Données personnelles</h2>
        <p>Les données collectées servent uniquement à la gestion de la réservation. Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression via info@multiwex.be.</p>
        <p className="mt-8 text-xs text-white/40">Multiwex SPRL · Rue des Deux Provinces 1 · 6900 Marche-en-Famenne · +32 (0)84 770 222 · info@multiwex.be</p>
      </div>
    </div>
  );
}
