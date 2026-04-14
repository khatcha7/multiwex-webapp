'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { listStaffUsers, setActiveStaff, logAudit } from '@/lib/data';

export default function StaffLoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setUsers(listStaffUsers());
  }, []);

  const login = () => {
    const user = users.find((u) => u.id === selectedId);
    if (!user) return alert('Choisissez un utilisateur');
    if (password !== 'staff' && password !== 'admin') return alert('Code: staff ou admin pour la démo');
    setActiveStaff(user);
    logAudit({ action: 'login', entityType: 'staff_session', entityId: user.id });
    router.push('/staff/calendar');
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="section-title mb-2 text-center">Back-office staff</h1>
      <p className="mb-8 text-center text-xs text-white/50">
        Démo : sélectionnez un utilisateur, mot de passe <code className="text-mw-pink">staff</code> ou <code className="text-mw-pink">admin</code>
      </p>
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Utilisateur</div>
          <div className="space-y-2">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedId(u.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm transition ${
                  selectedId === u.id ? 'border-mw-pink bg-mw-pink/10 text-white' : 'border-white/15 text-white/80 hover:border-white/40'
                }`}
              >
                <span>
                  <span className="display">{u.name}</span>
                  <span className="ml-2 text-xs text-white/40">{u.email}</span>
                </span>
                {u.permissions.all && <span className="chip chip-pink">admin</span>}
              </button>
            ))}
          </div>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()}
          placeholder="Mot de passe"
          className="input"
        />
        <button onClick={login} className="btn-primary w-full">
          Se connecter
        </button>
      </div>
    </div>
  );
}
