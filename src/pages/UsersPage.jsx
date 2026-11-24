import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, MoreHorizontal, Pencil, Plus, Search, Shield, UserRound, UsersRound } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { createTeamMember, loadTeamMembers, saveTeamMember } from '../services/authService';
import { formatDateTime } from '../utils/format';

const emptyForm = { name: '', email: '', role: 'Agent', team: 'Customer Care', password: '' };

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All roles');
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadUsers() {
    try {
      setUsers(await loadTeamMembers());
      setError('');
    }
    catch (loadError) { setError(loadError.message || 'Could not load users.'); }
  }

  useEffect(() => { loadUsers(); }, []);
  const activeUsers = users.filter((item) => item.active).length;
  const filtered = useMemo(() => users.filter((item) =>
    (showInactive || item.active)
    && (roleFilter === 'All roles' || item.role === roleFilter)
    && `${item.name} ${item.email} ${item.team}`.toLowerCase().includes(search.toLowerCase())), [users, roleFilter, showInactive, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setSuccess('');
    setModal(true);
  }

  function openEdit(member) {
    setEditing(member);
    setForm({ name: member.name, email: member.email, role: member.role, team: member.team || 'Customer Care', password: '' });
    setError('');
    setSuccess('');
    setModal(true);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (editing) {
        const updated = { ...editing, name: form.name.trim(), role: form.role, team: form.team, active: editing.uid === user.uid ? editing.active : form.active ?? editing.active };
        await saveTeamMember(updated);
        setUsers((current) => current.map((item) => item.uid === editing.uid ? updated : item));
        setSuccess('User details updated.');
      } else {
        const created = await createTeamMember({ name: form.name.trim(), email: form.email.trim(), role: form.role, team: form.team, password: form.password });
        setUsers((current) => [...current, created]);
        setSuccess('Team member added.');
      }
      setModal(false);
    } catch (saveError) {
      setError(saveError.message || 'Could not save this user.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(member) {
    if (member.uid === user.uid) return;
    const updated = { ...member, active: !member.active };
    try {
      await saveTeamMember(updated);
      setUsers((current) => current.map((item) => item.uid === member.uid ? updated : item));
    } catch (updateError) {
      setError(updateError.message || 'Could not update this account.');
    }
  }

  return (
    <div className="page-enter">
      <div className="page-heading"><div><div className="eyebrow-label">WORKSPACE ADMIN <span className="eyebrow-dot" /> TEAM</div><h1>User management</h1><p>Manage workspace access, roles, and team membership.</p></div><button className="btn btn-primary-custom" onClick={openCreate}><Plus size={17} />Add user</button></div>
      {error && !modal && <div className="alert alert-warning">{error}</div>}
      {success && <div className="alert alert-success"><Check size={16} />{success}</div>}
      <div className="user-stats-row"><div className="panel user-stat"><span className="user-stat-icon"><UsersRound size={18} /></span><span><strong>{users.length}</strong><small>Total users</small></span></div><div className="panel user-stat"><span className="user-stat-icon user-stat-active"><Check size={18} /></span><span><strong>{activeUsers}</strong><small>Active accounts</small></span></div><div className="panel user-stat"><span className="user-stat-icon user-stat-role"><Shield size={18} /></span><span><strong>{users.filter((item) => item.role === 'Supervisor').length}</strong><small>Supervisors</small></span></div></div>
      <section className="panel users-panel"><div className="calls-toolbar"><div className="calls-toolbar-title"><h2>Team members <span>{filtered.length}</span></h2><p>Only workspace administrators can manage user access</p></div><div className="calls-filters"><label className="table-search"><Search size={16} /><input placeholder="Search team…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="form-select filter-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter users by role"><option>All roles</option><option>Admin</option><option>Supervisor</option><option>Agent</option></select></div></div>
        <div className="table-responsive"><table className="table users-table align-middle mb-0"><thead><tr><th>USER</th><th>ROLE</th><th>TEAM</th><th>STATUS</th><th>LAST ACTIVE</th><th /></tr></thead><tbody>{filtered.map((member) => <tr key={member.uid}><td><div className="user-table-cell"><span className={`user-avatar avatar-${['lavender', 'peach', 'mint', 'blue'][member.name.length % 4]}`}>{member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{member.name}{member.uid === user.uid && <em>You</em>}</strong><small>{member.email}</small></span></div></td><td><span className={`role-label role-${member.role.toLowerCase()}`}><i />{member.role}</span></td><td>{member.team || '—'}</td><td><button className={`account-toggle ${member.active ? 'toggle-on' : ''}`} onClick={() => toggleActive(member)} disabled={member.uid === user.uid} aria-label={`${member.active ? 'Disable' : 'Enable'} ${member.name}`}><i />{member.active ? 'Active' : 'Inactive'}</button></td><td className="muted-cell">{member.createdAt ? formatDateTime(member.createdAt) : 'Recently'}</td><td><button className="row-chevron" aria-label={`Edit ${member.name}`} onClick={() => openEdit(member)}><Pencil size={15} /></button></td></tr>)}</tbody></table>
          {!filtered.length && <div className="table-empty"><UserRound size={22} /><strong>No users found</strong><span>Adjust your search or role filter.</span></div>}</div>
        <div className="table-footer"><label className="inactive-filter"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Show disabled accounts</label><span>{filtered.length} team members</span></div>
      </section>
      <div className="admin-note"><Shield size={16} /><span><strong>Admin access is protected.</strong> Role changes take effect immediately and are also enforced by Firebase Security Rules.</span></div>
      {modal && <div className="modal-backdrop-custom" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModal(false)}><section className="upload-dialog user-dialog" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title"><div className="dialog-heading"><div className="dialog-icon"><UserRound size={20} /></div><div><h2 id="user-dialog-title">{editing ? 'Edit team member' : 'Add a team member'}</h2><p>{editing ? 'Update profile and workspace access.' : 'Create an account for your support team.'}</p></div><button className="icon-button dialog-close" onClick={() => setModal(false)} aria-label="Close dialog">×</button></div>
        <form onSubmit={submit}><label className="form-label" htmlFor="user-name">Full name</label><input id="user-name" className="form-control mb-3" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Taylor Morgan" /><label className="form-label" htmlFor="user-email">Work email</label><input id="user-email" className="form-control mb-3" type="email" required disabled={Boolean(editing)} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@company.com" />{!editing && <><label className="form-label" htmlFor="user-password">Temporary password</label><input id="user-password" className="form-control mb-3" type="password" minLength="6" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 6 characters" /></>}
          <div className="row g-3"><div className="col-sm-6"><label className="form-label" htmlFor="user-role">Role</label><select id="user-role" className="form-select" value={form.role} disabled={editing?.uid === user.uid} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>Agent</option><option>Supervisor</option><option>Admin</option></select></div><div className="col-sm-6"><label className="form-label" htmlFor="user-team">Team</label><select id="user-team" className="form-select" value={form.team} onChange={(event) => setForm({ ...form, team: event.target.value })}><option>Customer Care</option><option>Retention</option><option>Technical Support</option></select></div></div>
          {editing && editing.uid !== user.uid && <label className="user-active-checkbox"><input type="checkbox" checked={form.active ?? editing.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Account enabled</label>}
          {error && <div className="form-error mt-3"><AlertCircle size={16} />{error}</div>}<div className="dialog-actions"><button type="button" className="btn btn-light" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="btn btn-primary-custom" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create account'}</button></div>
        </form></section></div>}
    </div>
  );
}
