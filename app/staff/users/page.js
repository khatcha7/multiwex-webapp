'use client';
import { useEffect, useState } from 'react';
import { listStaffUsers, saveStaffUsers, listAuditLog, logAudit } from '@/lib/data';

const PERMISSIONS = [
  { id: 'calendar', label: 'Calendrier' },
  { id: 'bookings_view', label: 'Voir réservations' },
  { id: 'bookings_edit', label: 'Modifier réservations' },
  { id: 'on_site_booking', label: 'Réservation sur place' },
  { id: 'financial_reports', label: 'Reports financiers' },
  { id: 'settings', label: 'Réglages' },
  { id: 'users_manage', label: 'Gestion équipe' },
];

export default function StaffUsersPage() {
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    setUsers(listStaffUsers());
    listAuditLog(30).then(setAudit);
  }, []);

  const updateUser = (id, patch) => {
    const next = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
    setUsers(next);
    saveStaffUsers(next);
    logAudit({ action: 'update_staff_user', entityType: 'staff_user', entityId: id, after: patch });
  };

  const togglePerm = (id, perm) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    const perms = { ...user.permissions };
    if (perms.all) delete perms.all;
    perms[perm] = !perms[perm];
    updateUser(id, { permissions: perms });
  };

  const addUser = () => {
    const name = prompt('Nom du nouveau membre');
    if (!name) return;
    const email = prompt('Email');
    if (!email) return;
    const u = {
      id: 'staff-' + Date.now(),
      email,
      name,
      permissions: { calendar: true, bookings_view: true, on_site_booking: true },
      active: true,
    };
    const next = [...users, u];
    setUsers(next);
    saveStaffUsers(next);
    logAudit({ action: 'create_staff_user', entityType: 'staff_user', entityId: u.id, after: u });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="section-title">Équipe</h1>
        <button onClick={addUser} className="btn-primary !py-2 text-xs">+ Ajouter</button>
      </div>

      <div className="mb-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/50">
            <tr>
              <th className="px-3 py-3 text-left">Nom</th>
              {PERMISSIONS.map((p) => (
                <th key={p.id} className="px-2 py-3 text-center text-[10px]">{p.label}</th>
              ))}
              <th className="px-3 py-3 text-center">Actif</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const hasAll = u.permissions?.all;
              return (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <div className="display">{u.name}</div>
                    <div className="text-[10px] text-white/40">{u.email}</div>
                  </td>
                  {PERMISSIONS.map((p) => (
                    <td key={p.id} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(hasAll || u.permissions?.[p.id])}
                        disabled={hasAll}
                        onChange={() => togglePerm(u.id, p.id)}
                        className="accent-mw-pink"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={u.active}
                      onChange={(e) => updateUser(u.id, { active: e.target.checked })}
                      className="accent-mw-pink"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="display mb-3 text-2xl">Audit log récent</h2>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-xs">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/50">
            <tr>
              <th className="px-3 py-2 text-left">Quand</th>
              <th className="px-3 py-2 text-left">Qui</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Entité</th>
              <th className="px-3 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id} className="border-b border-white/5">
                <td className="px-3 py-1.5 text-white/60">{new Date(a.createdAt || a.created_at).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-1.5">{a.staffUserName || a.staff_user_name || '—'}</td>
                <td className="px-3 py-1.5"><span className="chip">{a.action}</span></td>
                <td className="px-3 py-1.5 text-white/60">{a.entityType || a.entity_type}/{a.entityId || a.entity_id}</td>
                <td className="px-3 py-1.5 text-white/50">{a.notes || '—'}</td>
              </tr>
            ))}
            {audit.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-white/40">Aucune activité enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
