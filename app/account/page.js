'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useBooking } from '@/lib/store';
import { listBookings, getConfig, listGiftcards } from '@/lib/data';
import { getActivity } from '@/lib/activities';
import { getPackage } from '@/lib/packages';
import AddPlayersModal from '@/components/booking/AddPlayersModal';

export default function AccountPage() {
  const { user, setUser, hydrated } = useBooking();
  const [bookings, setBookings] = useState([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(null);
  const [giftCards, setGiftCards] = useState([]);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    if (hydrated && user) {
      listBookings({ customerEmail: user.email }).then(setBookings);
      listGiftcards({ email: user.email }).then(setGiftCards);
    }
  }, [hydrated, user]);

  if (!hydrated) return <div className="mx-auto max-w-4xl px-4 py-10 text-white/60">Chargement…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="section-title mb-2">Se connecter</h1>
        <p className="mb-6 text-sm text-white/60">Créez un compte pour retrouver vos réservations.</p>
        <div className="space-y-3 rounded border border-white/10 bg-mw-surface p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" placeholder="Nom" />
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" placeholder="Prénom" />
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="Email" type="email" />
          <button
            onClick={() => firstName && lastName && email && setUser({ firstName, lastName, name: `${firstName} ${lastName}`, email, createdAt: new Date().toISOString() })}
            className="btn-primary w-full"
          >
            Continuer
          </button>
          <p className="text-center text-[10px] text-white/40">Démo — aucun mot de passe requis</p>
        </div>
      </div>
    );
  }

  const totalSpent = bookings.reduce((s, b) => s + (b.total || 0), 0);
  const displayName = user.firstName ? `${user.firstName}` : user.name?.split(' ')[0] || '';
  const todayStr = new Date().toISOString().split('T')[0];

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'all') return true;
    if (filter === 'past') return b.date < todayStr;
    if (filter === 'today') return b.date === todayStr;
    if (filter === 'upcoming') return b.date >= todayStr;
    return true;
  });

  const canModify = (b) => {
    const items = b.items || [];
    if (items.length === 0) return false;
    const firstStart = items[0]?.start || items[0]?.slot_start || '00:00';
    const when = new Date(`${b.date}T${firstStart}:00`);
    return (when - new Date()) / 3600000 >= 24;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="section-title">Bonjour {displayName}</h1>
          <p className="text-sm text-white/60">{user.email}</p>
        </div>
        <button onClick={() => setUser(null)} className="btn-outline !py-2 text-xs">Déconnexion</button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Réservations" value={bookings.length} />
        <Stat label="Total dépensé" value={`${totalSpent.toFixed(2)}€`} />
        <Stat label="Membre depuis" value={new Date(user.createdAt).toLocaleDateString('fr-FR')} />
      </div>

      {/* Cartes cadeaux */}
      <div className="mb-8">
        <h2 className="display mb-3 text-2xl">Mes cartes cadeaux</h2>
        {giftCards.length === 0 ? (
          <div className="rounded border border-white/10 bg-mw-surface p-4 text-center">
            <div className="text-sm text-white/50 mb-2">Aucune carte cadeau associée à votre compte</div>
            <a href="/giftcard" className="text-xs text-mw-pink hover:underline">Acheter ou offrir une carte cadeau →</a>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {giftCards.map((gc) => {
              const bal = gc.balance != null ? gc.balance : gc.amount;
              const empty = bal <= 0;
              return (
                <div key={gc.code} className={`rounded border p-4 ${empty ? 'border-white/5 opacity-40' : 'border-mw-pink/30 bg-gradient-to-br from-mw-pink/10 to-mw-surface'}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm text-mw-pink">{gc.code}</div>
                    <div className="display text-xl">{bal.toFixed(2)}€</div>
                  </div>
                  <div className="mt-1 text-[10px] text-white/50">
                    {(gc.fromName || gc.from_name) && <>De {gc.fromName || gc.from_name} · </>}
                    {empty ? 'Épuisée' : 'Disponible'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="display text-2xl">Mes réservations</h2>
        <div className="flex items-center gap-1 rounded border border-white/15 bg-white/5 p-1">
          {[
            ['upcoming', 'À venir'],
            ['today', "Aujourd'hui"],
            ['past', 'Passées'],
            ['all', 'Tout'],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`display rounded px-3 py-1 text-xs ${filter === v ? 'bg-mw-pink text-white' : 'text-white/70'}`}>{l}</button>
          ))}
        </div>
      </div>
      {filteredBookings.length === 0 ? (
        <div className="rounded border border-white/10 bg-white/[0.02] p-10 text-center text-white/50">
          Aucune réservation pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((b) => {
            const isFormula = Boolean(b.packageId);
            const pkg = isFormula ? getPackage(b.packageId) : null;
            const isPast = b.date < todayStr;
            const isToday = b.date === todayStr;
            return (
              <div key={b.id || b.reference} className={`rounded border p-4 transition ${isPast ? 'opacity-50' : ''} ${isFormula ? 'border-mw-pink/40 bg-gradient-to-r from-mw-pink/5 to-mw-surface' : 'border-white/10 bg-mw-surface'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm text-mw-pink">{b.id || b.reference}</div>
                      {isFormula && pkg && <span className="chip chip-pink text-[10px]">{pkg.name}</span>}
                      {isPast && <span className="chip text-[10px] text-white/40">Passée</span>}
                      {isToday && <span className="chip chip-pink text-[10px]">Aujourd'hui</span>}
                    </div>
                    <div className="display text-lg">
                      {new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className="text-xs text-white/60">
                      {isFormula ? `${b.players || 0} participants · Formule ${pkg?.pricePerPerson || 0}€/pers` : `${b.players || 0} joueurs`}
                      {' · '}{(b.total || 0).toFixed(2)}€
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`chip ${b.paid ? 'chip-pink' : 'chip-red'}`}>{b.paid ? '✓ Payé' : 'Impayé'}</span>
                    {!isPast && canModify(b) && (
                      <button onClick={() => setEditing(b)} className="mt-2 block btn-outline !py-1.5 !px-3 text-xs">
                        + Joueurs
                      </button>
                    )}
                    {!isPast && !canModify(b) && (
                      <div className="mt-2 text-[10px] text-white/40">Modif. fermée (&lt;24h)</div>
                    )}
                  </div>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {(b.items || []).map((i, idx) => {
                    const act = getActivity(i.activityId || i.activity_id);
                    return (
                      <div key={idx} className="flex items-center gap-2 rounded bg-white/[0.03] p-2 text-xs">
                        {act && (
                          <div className="relative h-6 w-6 shrink-0">
                            <Image src={act.logo} alt="" fill sizes="24px" className="object-contain" />
                          </div>
                        )}
                        <div className="display flex-1 truncate">{i.activityName || act?.name}</div>
                        <div className="text-white/50">{i.players || '?'} joueurs</div>
                        <div className="font-mono text-mw-pink">{i.start || i.slot_start}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Boutons PDF + Partager */}
                <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
                  <button
                    onClick={() => {
                      const pdfName = getConfig('pdf.company_name') || 'MULTIWEX';
                      const pdfFooter = getConfig('pdf.footer') || '';
                      const pdfColor = getConfig('pdf.accent_color') || '#e8005a';
                      const w = window.open('', '_blank');
                      const items = (b.items || []).map((i) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${i.activityName || ''}</td><td style="padding:8px;border-bottom:1px solid #eee;">${i.start || ''}</td><td style="padding:8px;border-bottom:1px solid #eee;">${i.players || '?'} joueurs</td></tr>`).join('');
                      w.document.write(`<!doctype html><html><head><title>Réservation ${b.id}</title><style>body{font-family:sans-serif;background:#fff;color:#000;padding:40px;max-width:600px;margin:0 auto}h1{color:${pdfColor};font-size:28px;letter-spacing:0.1em}h2{font-size:18px;color:#333}table{width:100%;border-collapse:collapse;margin:20px 0}td{text-align:left}.footer{margin-top:30px;padding-top:15px;border-top:2px solid ${pdfColor};font-size:11px;color:#888}</style></head><body><h1>${pdfName}</h1><h2>Réservation ${b.id || b.reference}</h2><p style="font-size:16px;">${new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><p>${b.players || 0} joueurs · <strong>${(b.total || 0).toFixed(2)}€</strong></p><table>${items}</table><div class="footer">${pdfFooter}</div></body></html>`);
                      w.document.close();
                      w.print();
                    }}
                    className="flex items-center gap-1 text-xs text-white/50 hover:text-mw-pink"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    PDF
                  </button>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/invite/${b.id || b.reference}`;
                      const text = `On se retrouve au Multiwex !\n${new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}\n${(b.items || []).map((i) => `${i.activityName} à ${i.start}`).join('\n')}\n\nDétails : ${url}`;
                      if (navigator.share) {
                        navigator.share({ title: 'Invitation Multiwex', text, url });
                      } else {
                        navigator.clipboard.writeText(text);
                        alert('Lien d\'invitation copié !');
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-white/50 hover:text-mw-pink"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Partager
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <AddPlayersModal
          booking={editing}
          onClose={() => setEditing(null)}
          onUpdated={async () => {
            const refreshed = await listBookings({ customerEmail: user.email });
            setBookings(refreshed);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-white/10 bg-mw-surface p-5">
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className="display mt-1 text-2xl text-mw-pink">{value}</div>
    </div>
  );
}
