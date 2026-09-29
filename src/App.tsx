import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowRight, ArrowDownUp, CalendarDays, Check, ClipboardList, FileText, HeartPulse, LayoutDashboard, LogOut, Menu, Pill, QrCode, ScanLine, Search, ShieldCheck, Stethoscope, UserRound, Users, X } from 'lucide-react';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase, getProfile, formatDate, initials, type Doctor, type MedicalRecord, type Patient, type Profile, type Role } from './lib';

type AuthState = { session: { user: { id: string; email?: string } } | null; profile: Profile | null; loading: boolean };

type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' };
type ToastCtx = { push: (message: string, tone?: Toast['tone']) => void };
const ToastContext = createContext<ToastCtx>({ push: () => {} });
function useToast() { return useContext(ToastContext); }

function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  return <ToastContext.Provider value={{ push }}>{children}<div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 100, display: 'grid', gap: 10 }}>{toasts.map(t => <div key={t.id} className={`toast toast-${t.tone}`}><span>{t.message}</span></div>)}</div></ToastContext.Provider>;
}

function useAuth(): AuthState { return (window as unknown as { __mediAuth?: AuthState }).__mediAuth ?? { session: null, profile: null, loading: true }; }
function useAuthLoader(): AuthState {
  const [auth, setAuth] = useState<AuthState>({ session: null, profile: null, loading: true });
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => { if (!mounted) return; const profile = data.session ? await getProfile(data.session.user.id) : null; if (mounted) setAuth({ session: data.session as AuthState['session'], profile, loading: false }); });
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => { (async () => { const profile = session ? await getProfile(session.user.id) : null; if (mounted) setAuth({ session: session as AuthState['session'], profile, loading: false }); })(); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);
  return auth;
}

function Logo() { return <div className="brand"><div className="brand-mark">M</div><div>MEDI<small>Medical Easy Data ID</small></div></div>; }
function Avatar({ name }: { name: string }) { return <div className="avatar">{initials(name)}</div>; }

const doctorNav = [{ to: '/doctor', label: 'Dashboard', icon: LayoutDashboard }, { to: '/doctor/search', label: 'Search Patients', icon: Search }, { to: '/doctor/scan', label: 'Scan QR', icon: ScanLine }, { to: '/doctor/records', label: 'Medical Records', icon: ClipboardList }, { to: '/doctor/prescriptions', label: 'Prescriptions', icon: Pill }, { to: '/doctor/reports', label: 'Reports', icon: FileText }, { to: '/doctor/profile', label: 'Profile', icon: UserRound }];
const patientNav = [{ to: '/patient', label: 'Dashboard', icon: LayoutDashboard }, { to: '/patient/profile', label: 'My Profile', icon: UserRound }, { to: '/patient/qr', label: 'My QR Code', icon: QrCode }, { to: '/patient/records', label: 'Medical Records', icon: ClipboardList }, { to: '/patient/history', label: 'Medical History', icon: CalendarDays }, { to: '/patient/prescriptions', label: 'Prescriptions', icon: Pill }, { to: '/patient/reports', label: 'Reports', icon: FileText }];

function Shell({ children, profile }: { children: ReactNode; profile: Profile }) {
  const [open, setOpen] = useState(false); const navigate = useNavigate(); const location = useLocation(); const nav = profile.role === 'doctor' ? doctorNav : patientNav;
  async function logout(): Promise<void> { await supabase.auth.signOut(); navigate('/login'); }
  return <div className="app-shell"><aside className={`sidebar ${open ? 'open' : ''}`}><Logo/><div className="nav-section">Workspace</div>{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/doctor' || to === '/patient'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}><Icon size={17}/>{label}</NavLink>)}<div className="side-bottom"><div className="user-mini"><Avatar name={profile.display_name}/><div><strong>{profile.display_name}</strong><span>{profile.role} account</span></div></div><button className="nav-link" onClick={logout}><LogOut size={17}/>Sign out</button></div></aside><main className="main-area"><header className="topbar"><button className="mobile-menu" onClick={() => setOpen(!open)}><Menu size={23}/></button><div><div className="topbar-kicker">MEDI / {profile.role === 'doctor' ? 'Clinical workspace' : 'Personal health record'}</div><h2>{pageTitle(location.pathname, profile.role)}</h2></div><div className="no-print" style={{ display:'flex', alignItems:'center', gap:10 }}><ShieldCheck size={16} color="#168d82"/><span style={{ fontSize:12, color:'#66838e' }}>Secure session</span></div></header>{children}</main></div>;
}
function pageTitle(path: string, role: Role): string { if (path.includes('search')) return 'Find a patient'; if (path.includes('scan')) return 'Scan MEDI QR'; if (path.includes('prescriptions')) return 'Prescriptions'; if (path.includes('records')) return 'Medical records'; if (path.includes('reports')) return 'Reports'; if (path.includes('profile')) return role === 'doctor' ? 'Professional profile' : 'My profile'; if (path.includes('qr')) return 'My QR code'; if (path.includes('history')) return 'Medical history'; return 'Overview'; }
function Protected({ role, children }: { role: Role; children: ReactNode }) { const auth = useAuth(); if (auth.loading) return <div className="loading">Loading your secure workspace…</div>; if (!auth.session) return <Navigate to="/login" replace/>; if (auth.profile?.role !== role) return <Navigate to={`/${auth.profile?.role ?? 'login'}`} replace/>; return <Shell profile={auth.profile}>{children}</Shell>; }

function AuthPage({ initialRole = 'patient' }: { initialRole?: Role }) {
  const navigate = useNavigate(); const toast = useToast(); const [mode, setMode] = useState<'login'|'signup'>('login'); const [role, setRole] = useState<Role>(initialRole); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent): Promise<void> { e.preventDefault(); setError(''); setBusy(true); try { if (mode === 'login') { const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password }); if (loginError) throw loginError; const p = data.user ? await getProfile(data.user.id) : null; if (!p || p.role !== role) { await supabase.auth.signOut(); throw new Error(`This account is not registered as a ${role}.`); } toast.push('Login successful', 'success'); navigate(`/${role}`); } else { if (!name.trim()) throw new Error('Please enter your full name.'); const { data, error: signError } = await supabase.auth.signUp({ email, password, options: { data: { role, display_name: name.trim() } } }); if (signError) throw signError; if (!data.user) throw new Error('Account creation could not be completed.'); toast.push('Account created. Complete your profile to continue.', 'success'); navigate(`/register/${role}`); } } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); } finally { setBusy(false); } }
  return <div className="auth-page"><section className="auth-art"><Logo/><div className="auth-copy"><div className="eyebrow" style={{ color:'#63d5c8' }}>Your Medical Identity, Anywhere.</div><h1>Care records that move with you.</h1><p>MEDI gives patients a secure health identity and gives care teams the context they need, when they need it.</p><div className="auth-points"><div className="auth-point"><span className="check"><Check size={14}/></span>One secure identity for every visit</div><div className="auth-point"><span className="check"><Check size={14}/></span>Private, connected medical history</div><div className="auth-point"><span className="check"><Check size={14}/></span>Built for patients and providers</div></div></div><div className="auth-footer">MEDI · Medical Easy Data ID · Privacy-first healthcare</div></section><section className="auth-form-side"><div className="auth-form"><div className="eyebrow">Welcome to MEDI</div><h2>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2><p className="sub">{mode === 'login' ? 'Access your secure healthcare workspace.' : 'Start your secure medical identity in minutes.'}</p><div className="auth-tabs"><button className={role === 'patient' ? 'active' : ''} onClick={() => setRole('patient')}>Patient</button><button className={role === 'doctor' ? 'active' : ''} onClick={() => setRole('doctor')}>Doctor</button></div><form className="card" onSubmit={submit}>{mode === 'signup' && <div className="field"><label>Full name</label><input value={name} onChange={e => setName(e.target.value)} placeholder={role === 'doctor' ? 'Dr. Priya Sharma' : 'Alex Morgan'} /></div>}<div className="field" style={{ marginTop: mode === 'signup' ? 15 : 0 }}><label>Email address</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div><div className="field" style={{ marginTop:15 }}><label>Password</label><input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></div>{error && <div className="error-msg" style={{ marginTop:15 }}>{error}</div>}<button className="btn btn-primary" disabled={busy} style={{ marginTop:20 }}>{busy ? 'Please wait…' : mode === 'login' ? `Sign in as ${role}` : `Create ${role} account`}<ArrowRight size={16}/></button>{mode === 'login' && <div className="demo-note"><strong>Demo-ready:</strong> create a patient or doctor account below, then complete the short profile setup.</div>}</form><p className="auth-switch">{mode === 'login' ? 'New to MEDI?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></p></div></section></div>;
}

function RegisterPage({ role }: { role: Role }) {
  const auth = useAuth(); const navigate = useNavigate(); const toast = useToast(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [form, setForm] = useState<Record<string,string>>({}); const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  async function submit(e: FormEvent): Promise<void> { e.preventDefault(); if (!auth.session) return; setBusy(true); setError(''); try { if (role === 'patient') { const { error } = await supabase.from('patients').insert({ user_id: auth.session.user.id, full_name: form.full_name, age: Number(form.age), gender: form.gender, date_of_birth: form.date_of_birth || null, phone: form.phone, email: auth.session.user.email, address: form.address, blood_group: form.blood_group, emergency_contact: form.emergency_contact }); if (error) throw error; } else { const { error } = await supabase.from('doctors').insert({ user_id: auth.session.user.id, doctor_name: form.doctor_name, specialization: form.specialization, hospital: form.hospital, phone: form.phone }); if (error) throw error; } toast.push('Profile created successfully', 'success'); navigate(`/${role}`); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your profile.'); } finally { setBusy(false); } }
  const patientFields = [['full_name','Full name'],['age','Age'],['date_of_birth','Date of birth'],['phone','Phone number'],['address','Address'],['blood_group','Blood group'],['emergency_contact','Emergency contact']];
  return <div className="auth-page"><section className="auth-art"><Logo/><div className="auth-copy"><div className="eyebrow" style={{ color:'#63d5c8' }}>One more step</div><h1>{role === 'patient' ? 'Set up your health identity.' : 'Set up your clinical profile.'}</h1><p>{role === 'patient' ? 'Your unique MEDI ID and QR code will be created automatically after you save these details.' : 'Your professional profile connects your visits and prescriptions to your patients.'}</p></div></section><section className="auth-form-side"><div className="auth-form"><div className="eyebrow">Profile setup</div><h2>{role === 'patient' ? 'Patient details' : 'Doctor details'}</h2><p className="sub">This information is used to keep your records accurate.</p><form className="card" onSubmit={submit}><div className="form-grid">{role === 'patient' ? <>{patientFields.map(([key,label]) => <div className={`field ${key === 'address' ? 'full' : ''}`} key={key}><label>{label}</label>{key === 'address' ? <textarea required={key === 'address'} value={form[key] ?? ''} onChange={e => update(key,e.target.value)} /> : <input required={['full_name','age','phone'].includes(key)} type={key === 'age' ? 'number' : key === 'date_of_birth' ? 'date' : 'text'} value={form[key] ?? ''} onChange={e => update(key,e.target.value)} />}</div>)}<div className="field"><label>Gender</label><select required value={form.gender ?? ''} onChange={e => update('gender',e.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select></div></> : <>{[['doctor_name','Doctor name'],['specialization','Specialization'],['hospital','Hospital / clinic'],['phone','Phone number']].map(([key,label]) => <div className="field" key={key}><label>{label}</label><input required={['doctor_name','hospital'].includes(key)} value={form[key] ?? ''} onChange={e => update(key,e.target.value)} /></div>)}</>}</div>{error && <div className="error-msg" style={{ marginTop:16 }}>{error}</div>}<div className="form-actions" style={{ marginTop:20 }}><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create secure profile'}<ArrowRight size={16}/></button></div></form></div></section></div>;
}

function usePatientRecords(patientId?: string): { records: MedicalRecord[]; loading: boolean; reload: () => void } {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    let q = supabase.from('medical_records').select('*, doctors(doctor_name,hospital,specialization), patients(full_name,patient_id,age,gender,blood_group)').order('visit_date', { ascending: false });
    if (patientId) q = q.eq('patient_id', patientId);
    q.then(({ data }) => { setRecords((data ?? []) as MedicalRecord[]); setLoading(false); });
  };
  useEffect(load, [patientId]);
  return { records, loading, reload: load };
}

function DoctorDashboard() {
  const auth = useAuth(); const navigate = useNavigate(); const [stats, setStats] = useState({ totalPatients: 0, totalRecords: 0, todayVisits: 0, prescriptions: 0 }); const [recentPatients, setRecentPatients] = useState<Patient[]>([]); const [recentRecords, setRecentRecords] = useState<MedicalRecord[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      supabase.from('patients').select('*', { count: 'exact', head: false }),
      supabase.from('medical_records').select('visit_date,prescription', { count: 'exact' }),
      supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('medical_records').select('*, doctors(doctor_name,hospital,specialization)').order('visit_date', { ascending: false }).limit(5),
    ]).then(([p, r, rp, rr]) => {
      const today = new Date().toISOString().slice(0, 10);
      const records = (r.data ?? []) as { visit_date: string; prescription: string | null }[];
      setStats({ totalPatients: p.count ?? 0, totalRecords: r.count ?? 0, todayVisits: records.filter(x => x.visit_date === today).length, prescriptions: records.filter(x => x.prescription).length });
      setRecentPatients((rp.data ?? []) as Patient[]);
      setRecentRecords((rr.data ?? []) as MedicalRecord[]);
      setLoading(false);
    });
  }, []);
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">Welcome, {auth.profile?.display_name.split(' ')[0]}</div><h1 className="page-heading">Your clinical workspace</h1><p className="muted">A clear view of patients, visits, and care activity.</p></div><div className="action-row"><button className="btn btn-outline" onClick={()=>navigate('/doctor/scan')}><ScanLine size={16}/>Scan QR</button><button className="btn btn-primary" onClick={()=>navigate('/doctor/search')}><Search size={16}/>Find patient</button></div></div><div className="stat-grid"><Stat icon={Users} label="Total patients" value={loading ? '…' : stats.totalPatients} tone="teal"/><Stat icon={ClipboardList} label="Medical records" value={loading ? '…' : stats.totalRecords} tone="blue"/><Stat icon={CalendarDays} label="Today's visits" value={loading ? '…' : stats.todayVisits} tone="amber"/><Stat icon={Pill} label="Prescriptions" value={loading ? '…' : stats.prescriptions} tone="coral"/></div><div className="split"><section className="card"><div className="card-header"><h3>Recent patients</h3><button className="link-btn" onClick={()=>navigate('/doctor/search')}>View all</button></div><div className="card-body">{loading ? <div className="loading">Loading…</div> : recentPatients.length ? recentPatients.map(p=><div className="patient-card" key={p.id} onClick={()=>navigate(`/doctor/patient/${p.id}`)} style={{cursor:'pointer'}}><Avatar name={p.full_name}/><div><h4>{p.full_name}</h4><p>{p.patient_id} · {p.gender} · {p.age} years</p></div><div className="right"><strong>Open profile</strong><span className="muted" style={{fontSize:11}}>View history</span></div></div>) : <div className="empty">No patients yet. Use Search Patients to begin.</div>}</div></section><section className="card"><div className="card-header"><h3>Latest records</h3><button className="link-btn" onClick={()=>navigate('/doctor/records')}>View all</button></div><div className="card-body">{loading ? <div className="loading">Loading…</div> : recentRecords.length ? recentRecords.slice(0,4).map(r=><div className="patient-card" key={r.id}><div className="stat-icon accent-teal" style={{margin:0}}><HeartPulse size={17}/></div><div><h4>{r.diagnosis}</h4><p>{formatDate(r.visit_date)} · {r.doctors?.doctor_name ?? 'Doctor'}</p></div></div>) : <div className="empty">Your saved visits will appear here.</div>}</div></section></div></div>;
}
function Stat({ icon:Icon,label,value,tone }: { icon: typeof Users;label:string;value:string|number;tone:string }) { return <div className="stat-card"><div className={`stat-icon accent-${tone}`}><Icon size={18}/></div><p>{label}</p><h3>{value}</h3><div className="mini">Live workspace data</div></div> }

function PatientDashboard() {
  const auth = useAuth(); const toast = useToast(); const [patient, setPatient] = useState<Patient|null>(null); const [records, setRecords] = useState<MedicalRecord[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!auth.session) return;
    Promise.all([
      supabase.from('patients').select('*').eq('user_id', auth.session.user.id).maybeSingle(),
      supabase.from('medical_records').select('*, doctors(doctor_name,hospital,specialization)').order('visit_date', { ascending: false }),
    ]).then(([p, r]) => {
      setPatient(p.data as Patient|null);
      setRecords((r.data ?? []) as MedicalRecord[]);
      setLoading(false);
    });
  }, [auth.session]);
  if (loading) return <div className="content"><div className="loading">Loading your health summary…</div></div>;
  if (!patient) return <div className="content"><div className="alert">Complete your patient profile to generate your MEDI ID and unlock your health record.</div></div>;
  const latest = records[0];
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">Welcome back, {patient.full_name.split(' ')[0]}</div><h1 className="page-heading">Your health at a glance</h1><p className="muted">Your medical identity and care history, all in one secure place.</p></div><div className="patient-id">{patient.patient_id}</div></div><div className="stat-grid"><Stat icon={CalendarDays} label="Total visits" value={records.length} tone="teal"/><Stat icon={HeartPulse} label="Latest diagnosis" value={latest?.diagnosis ?? 'None yet'} tone="blue"/><Stat icon={Pill} label="Prescriptions" value={records.filter(r=>r.prescription).length} tone="amber"/><Stat icon={QrCode} label="Your MEDI ID" value="Active" tone="coral"/></div><div className="split"><section className="card"><div className="card-header"><h3>Latest medical record</h3><NavLink className="link-btn" to="/patient/records">View all</NavLink></div><div className="card-body">{latest ? <RecordCard record={latest}/> : <div className="empty">Your doctor-entered records will appear here after your first visit.</div>}</div></section><QrPanel patient={patient}/></div></div>;
}

function QrPanel({ patient }: { patient: Patient }) {
  const [src, setSrc] = useState(''); const toast = useToast();
  useEffect(() => { QRCode.toDataURL(patient.qr_code, { width: 400, margin: 2, color: { dark: '#073b50', light: '#ffffff' } }).then(setSrc); }, [patient.qr_code]);
  function download() { const a = document.createElement('a'); a.href = src; a.download = `${patient.patient_id}-qr.png`; a.click(); toast.push('QR code downloaded', 'success'); }
  return <section className="card qr-panel"><div className="eyebrow">Your secure identity</div><h3>MEDI QR code</h3>{src ? <img src={src} alt={`QR code for ${patient.patient_id}`}/> : <div style={{height:180}}/>}<div className="patient-id">{patient.patient_id}</div><p className="muted" style={{fontSize:12}}>Show this code to an authorized doctor. It contains only your MEDI ID.</p><div className="action-row" style={{justifyContent:'center'}}><button className="btn btn-light" onClick={download}><QrCode size={15}/>Download</button><button className="btn btn-outline" onClick={()=>window.print()}><FileText size={15}/>Print</button></div></section>;
}

function PatientQrPage() {
  const auth = useAuth(); const [patient, setPatient] = useState<Patient|null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { if (auth.session) supabase.from('patients').select('*').eq('user_id', auth.session.user.id).maybeSingle().then(({data}) => { setPatient(data as Patient|null); setLoading(false); }); }, [auth.session]);
  if (loading) return <div className="content"><div className="loading">Loading…</div></div>;
  if (!patient) return <div className="content"><div className="alert">Complete your profile to access your QR code.</div></div>;
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">Your secure identity</div><h1 className="page-heading">My QR Code</h1><p className="muted">Print or save this code for your MEDI card.</p></div></div><div className="grid-2"><QrPanel patient={patient}/><section className="card"><div className="card-header"><h3>How it works</h3></div><div className="card-body"><div className="info-list"><Info label="What's stored" value="Only your MEDI Patient ID"/><Info label="Not stored" value="No diagnosis, medicines, or contact info"/><Info label="Who can scan" value="Only authorized doctors with a MEDI account"/><Info label="Your Patient ID" value={patient.patient_id}/></div><div className="alert" style={{marginTop:18}}>Keep this code private. An authorized doctor scans it to open your medical profile securely.</div></div></section></div></div>;
}

function PatientProfileView({ doctorView=false }: { doctorView?: boolean }) {
  const { id } = useParams(); const auth = useAuth(); const [patient, setPatient] = useState<Patient|null>(null); const [records, setRecords] = useState<MedicalRecord[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    const query = doctorView ? supabase.from('patients').select('*').eq('id', id).maybeSingle() : supabase.from('patients').select('*').eq('user_id', auth.session?.user.id).maybeSingle();
    query.then(({data}) => {
      setPatient(data as Patient|null);
      if (data) supabase.from('medical_records').select('*, doctors(doctor_name,hospital,specialization)').eq('patient_id', (data as Patient).id).order('visit_date', {ascending:false}).then(({data:r}) => setRecords((r ?? []) as MedicalRecord[]));
      setLoading(false);
    });
  }, [id, doctorView, auth.session]);
  if (loading) return <div className="content"><div className="loading">Loading profile…</div></div>;
  if (!patient) return <div className="content"><div className="empty">Patient profile not found.</div></div>;
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">Patient profile</div><h1 className="page-heading">{patient.full_name}</h1><p className="muted">{patient.patient_id} · Secure patient profile</p></div>{doctorView && <NavLink to={`/doctor/patient/${patient.id}/add-record`} className="btn btn-primary"><HeartPulse size={16}/>Add medical record</NavLink>}</div><div className="split"><section className="card"><div className="card-header"><h3>Personal information</h3></div><div className="card-body"><div className="info-list"><Info label="Full name" value={patient.full_name}/><Info label="Patient ID" value={patient.patient_id}/><Info label="Age / gender" value={`${patient.age} years · ${patient.gender}`}/><Info label="Date of birth" value={formatDate(patient.date_of_birth)}/><Info label="Blood group" value={patient.blood_group || 'Not provided'}/><Info label="Phone" value={patient.phone}/><Info label="Email" value={patient.email}/><Info label="Address" value={patient.address || 'Not provided'}/><Info label="Emergency contact" value={patient.emergency_contact || 'Not provided'}/></div></div></section><QrPanel patient={patient}/></div><section className="card" style={{marginTop:20}}><div className="card-header"><h3>Medical history</h3><span className="muted" style={{fontSize:12}}>{records.length} visit{records.length===1?'':'s'}</span></div><div className="card-body">{records.length ? <div className="timeline">{records.map(r => <div className="timeline-item" key={r.id}><div className="timeline-dot"/><RecordCard record={r}/></div>)}</div> : <div className="empty">No medical records have been entered yet.</div>}</div></section></div>;
}
function Info({label,value}:{label:string;value:string}){return <div className="info-row"><span>{label}</span><strong>{value}</strong></div>;}

function RecordCard({ record, onPrint }: { record: MedicalRecord; onPrint?: () => void }) {
  return <div className="record-card"><div className="record-top"><div><h4>{record.diagnosis}</h4><p>{formatDate(record.visit_date)} · {record.doctors?.doctor_name ?? 'Doctor'}{record.doctors?.hospital ? ` · ${record.doctors.hospital}` : ''}</p></div><div style={{display:'flex',gap:8,alignItems:'flex-start'}}><span className="record-badge">Visit record</span>{onPrint && <button className="link-btn no-print" onClick={onPrint}><FileText size={14}/>Print</button>}</div></div><div className="record-fields">{record.symptoms && <RecordField label="Symptoms" value={record.symptoms}/>} {record.medicines && <RecordField label="Medicines" value={record.medicines}/>} {record.dosage && <RecordField label="Dosage" value={record.dosage}/>} {record.frequency && <RecordField label="Frequency" value={record.frequency}/>} {record.duration && <RecordField label="Duration" value={record.duration}/>} {record.prescription && <RecordField label="Prescription" value={record.prescription}/>} {record.follow_up_date && <RecordField label="Follow-up" value={formatDate(record.follow_up_date)}/>} {record.medical_notes && <RecordField label="Medical notes" value={record.medical_notes}/>}</div></div>;
}
function RecordField({label,value}:{label:string;value:string}){return <div className="record-field"><span>{label}</span><strong>{value}</strong></div>;}

function SearchPatients() {
  const [term, setTerm] = useState(''); const [patients, setPatients] = useState<Patient[]>([]); const [searched, setSearched] = useState(false); const [loading, setLoading] = useState(false);
  async function search(e?: FormEvent) { e?.preventDefault(); const q = term.trim(); if (!q) { setPatients([]); setSearched(false); return; } setLoading(true); const { data } = await supabase.from('patients').select('*').or(`patient_id.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`).limit(20); setPatients((data ?? []) as Patient[]); setSearched(true); setLoading(false); }
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">Patient directory</div><h1 className="page-heading">Find a patient</h1><p className="muted">Search by MEDI ID, name, email, or phone number.</p></div><NavLink className="btn btn-outline" to="/doctor/scan"><ScanLine size={16}/>Scan QR instead</NavLink></div><section className="card"><div className="card-body"><form className="search-box" onSubmit={search}><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="e.g. MEDI-2026-00001 or Alex Morgan"/><button className="btn btn-primary" disabled={loading}><Search size={16}/>{loading ? 'Searching…' : 'Search'}</button></form></div></section><section className="card" style={{marginTop:20}}><div className="card-header"><h3>{searched ? `${patients.length} patient${patients.length===1?'':'s'} found` : 'Search results'}</h3></div><div className="card-body">{loading ? <div className="loading">Searching…</div> : patients.length ? patients.map(p => <NavLink key={p.id} to={`/doctor/patient/${p.id}`} style={{textDecoration:'none',color:'inherit'}}><div className="patient-card"><Avatar name={p.full_name}/><div><h4>{p.full_name}</h4><p>{p.patient_id} · {p.gender} · {p.age} years · {p.blood_group || 'Blood group not provided'}</p></div><div className="right"><strong>Open profile <ArrowRight size={13} style={{verticalAlign:'middle'}}/></strong></div></div></NavLink>) : <div className="empty">{searched ? 'No patients matched that search. Try a different detail.' : 'Enter a search term to find a patient.'}</div>}</div></section></div>;
}

function AddRecord() {
  const { id } = useParams(); const navigate = useNavigate(); const toast = useToast(); const [patient, setPatient] = useState<Patient|null>(null); const [doctor, setDoctor] = useState<Doctor|null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [form, setForm] = useState<Record<string,string>>({visit_date: new Date().toISOString().slice(0,10)}); const update = (k:string,v:string) => setForm(p => ({...p,[k]:v}));
  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      if (data.user) Promise.all([supabase.from('patients').select('*').eq('id', id).maybeSingle(), supabase.from('doctors').select('*').eq('user_id', data.user.id).maybeSingle()]).then(([p, d]) => { setPatient(p.data as Patient|null); setDoctor(d.data as Doctor|null); });
    });
  }, [id]);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!doctor || !patient) return; if (!form.diagnosis?.trim()) { setError('Diagnosis is required.'); return; } setBusy(true); setError('');
    const { error } = await supabase.from('medical_records').insert({ patient_id: patient.id, doctor_id: doctor.id, visit_date: form.visit_date, diagnosis: form.diagnosis, symptoms: form.symptoms, medicines: form.medicines, dosage: form.dosage, duration: form.duration, frequency: form.frequency, prescription: form.prescription, medical_notes: form.medical_notes, follow_up_date: form.follow_up_date || null });
    if (error) setError(error.message); else { toast.push('Medical record saved and shared with the patient', 'success'); navigate(`/doctor/patient/${patient.id}`); } setBusy(false);
  }
  const fields = [['diagnosis','Diagnosis',true],['symptoms','Symptoms',false],['medicines','Medicines',false],['dosage','Dosage',false],['frequency','Frequency (e.g. Twice daily)',false],['duration','Medicine duration',false],['prescription','Prescription / instructions',false],['medical_notes','Medical notes',false]] as const;
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">New visit record</div><h1 className="page-heading">Add care notes</h1><p className="muted">Adding a secure record for <strong>{patient?.full_name ?? 'patient'}</strong> · {patient?.patient_id}</p></div><button className="btn btn-outline" onClick={()=>navigate(-1)}><X size={16}/>Cancel</button></div><section className="card"><div className="card-body"><form onSubmit={submit}><div className="form-grid"><div className="field"><label>Visit date</label><input type="date" required value={form.visit_date ?? ''} onChange={e=>update('visit_date',e.target.value)}/></div>{fields.map(([key,label,required]) => <div className={`field ${['prescription','medical_notes'].includes(key) ? 'full' : ''}`} key={key}><label>{label}</label>{['symptoms','prescription','medical_notes'].includes(key) ? <textarea required={required} value={form[key] ?? ''} onChange={e=>update(key,e.target.value)} placeholder={`Enter ${label.toLowerCase()}`}/> : <input required={required} value={form[key] ?? ''} onChange={e=>update(key,e.target.value)} placeholder={`Enter ${label.toLowerCase()}`}/>}</div>)}</div>{error && <div className="error-msg" style={{marginTop:18}}>{error}</div>}<div className="form-actions" style={{marginTop:20}}><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save medical record'}<Check size={16}/></button></div></form></div></section></div>;
}

function ScanPage() {
  const [manual, setManual] = useState(''); const [error, setError] = useState(''); const [scanning, setScanning] = useState(false); const navigate = useNavigate(); const toast = useToast();
  useEffect(() => {
    if (!scanning) return;
    const scanner = new Html5Qrcode('medi-reader');
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, async (decoded) => {
      await scanner.stop(); setScanning(false);
      const { data } = await supabase.from('patients').select('id').eq('patient_id', decoded.trim().toUpperCase()).maybeSingle();
      if (data) { toast.push('Patient found', 'success'); navigate(`/doctor/patient/${data.id}`); } else setError('This QR code is not a valid MEDI Patient ID.');
    }, () => undefined).catch(() => { setScanning(false); setError('Camera unavailable. Check browser permission or enter the Patient ID manually.'); });
    return () => { if (scanner.isScanning) scanner.stop().catch(()=>undefined); };
  }, [scanning, navigate, toast]);
  async function find() { setError(''); const { data } = await supabase.from('patients').select('id').eq('patient_id', manual.trim().toUpperCase()).maybeSingle(); if (data) { toast.push('Patient found', 'success'); navigate(`/doctor/patient/${data.id}`); } else setError('Patient not found. Check the MEDI ID and try again.'); }
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">Fast patient access</div><h1 className="page-heading">Scan MEDI QR</h1><p className="muted">Use the camera on a phone, or enter the patient ID manually.</p></div></div><div className="grid-2"><section className="card"><div className="card-header"><h3><ScanLine size={18} style={{verticalAlign:'middle',marginRight:8}}/>Camera scanner</h3></div><div className="card-body"><div style={{minHeight:230,borderRadius:12,background:'#eaf5f5',display:'grid',placeItems:'center',textAlign:'center',padding:scanning?12:24}}>{scanning ? <div id="medi-reader" style={{width:'100%'}}/> : <div><div className="stat-icon accent-teal" style={{margin:'0 auto 14px'}}><QrCode size={28}/></div><h3 style={{fontSize:16}}>Camera scanning</h3><p className="muted" style={{fontSize:13,maxWidth:250}}>Allow camera access to scan a patient's printed MEDI card.</p><button className="btn btn-primary" onClick={()=>{setError(''); setScanning(true)}}><ScanLine size={15}/>Start camera</button></div>}</div>{scanning && <button className="btn btn-outline" style={{marginTop:12}} onClick={()=>setScanning(false)}>Stop camera</button>}{error && <div className="error-msg" style={{marginTop:15}}>{error}</div>}</div></section><section className="card"><div className="card-header"><h3>Enter Patient ID</h3></div><div className="card-body"><p className="muted" style={{fontSize:13}}>The QR code contains only this identifier, for privacy.</p><div className="field" style={{marginTop:18}}><label>MEDI Patient ID</label><input value={manual} onChange={e=>setManual(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')find()}} placeholder="MEDI-2026-00001"/></div><button className="btn btn-primary" style={{marginTop:16}} onClick={find} disabled={!manual.trim()}><Search size={16}/>Open patient</button><div className="alert" style={{marginTop:28}}>Patient data is only shown to signed-in doctors. Every access is tied to your clinical account.</div></div></section></div></div>;
}

function useFilteredRecords(records: MedicalRecord[]) {
  const [search, setSearch] = useState(''); const [sortDir, setSortDir] = useState<'new'|'old'>('new'); const [dateFilter, setDateFilter] = useState('');
  const filtered = useMemo(() => {
    let result = records;
    if (search.trim()) { const q = search.trim().toLowerCase(); result = result.filter(r => r.diagnosis.toLowerCase().includes(q) || (r.medicines ?? '').toLowerCase().includes(q) || (r.doctors?.doctor_name ?? '').toLowerCase().includes(q) || (r.symptoms ?? '').toLowerCase().includes(q)); }
    if (dateFilter) result = result.filter(r => r.visit_date === dateFilter);
    return [...result].sort((a, b) => sortDir === 'new' ? b.visit_date.localeCompare(a.visit_date) : a.visit_date.localeCompare(b.visit_date));
  }, [records, search, sortDir, dateFilter]);
  return { search, setSearch, sortDir, setSortDir, dateFilter, setDateFilter, filtered };
}

function RecordsPage({ patientRole=false }: { patientRole?: boolean }) {
  const auth = useAuth(); const [records, setRecords] = useState<MedicalRecord[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!auth.session) return;
    const load = async () => {
      let patientId: string | undefined;
      if (patientRole) { const { data: patient } = await supabase.from('patients').select('id').eq('user_id', auth.session!.user.id).maybeSingle(); patientId = patient?.id; }
      let q = supabase.from('medical_records').select('*, doctors(doctor_name,hospital,specialization), patients(full_name,patient_id,age,gender,blood_group)').order('visit_date', { ascending: false });
      if (patientRole && patientId) q = q.eq('patient_id', patientId);
      const { data } = await q; setRecords((data ?? []) as MedicalRecord[]); setLoading(false);
    };
    load();
  }, [patientRole, auth.session]);
  const { search, setSearch, sortDir, setSortDir, dateFilter, setDateFilter, filtered } = useFilteredRecords(records);
  function printRecord(record: MedicalRecord) {
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(`<html><head><title>MEDI Report - ${record.diagnosis}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#17324d}h1{color:#0e857e}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:10px 12px;border-bottom:1px solid #e4eff1;font-size:14px}td:first-child{color:#75909b;width:40%}td:last-child{font-weight:600}.header{display:flex;justify-content:space-between;border-bottom:3px solid #0e857e;padding-bottom:20px;margin-bottom:20px}.brand{font-size:28px;font-weight:800;color:#083b55}</style></head><body><div class="header"><div class="brand">MEDI</div><div>Medical Report<br>${formatDate(record.visit_date)}</div></div><h1>${record.diagnosis}</h1><table><tr><td>Visit date</td><td>${formatDate(record.visit_date)}</td></tr><tr><td>Doctor</td><td>${record.doctors?.doctor_name ?? '—'}</td></tr><tr><td>Hospital</td><td>${record.doctors?.hospital ?? '—'}</td></tr><tr><td>Symptoms</td><td>${record.symptoms ?? '—'}</td></tr><tr><td>Medicines</td><td>${record.medicines ?? '—'}</td></tr><tr><td>Dosage</td><td>${record.dosage ?? '—'}</td></tr><tr><td>Frequency</td><td>${record.frequency ?? '—'}</td></tr><tr><td>Duration</td><td>${record.duration ?? '—'}</td></tr><tr><td>Prescription</td><td>${record.prescription ?? '—'}</td></tr><tr><td>Notes</td><td>${record.medical_notes ?? '—'}</td></tr><tr><td>Follow-up</td><td>${formatDate(record.follow_up_date)}</td></tr></table></body></html>`);
    win.document.close(); win.print();
  }
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">{patientRole ? 'Your care history' : 'Clinical activity'}</div><h1 className="page-heading">Medical records</h1><p className="muted">{patientRole ? 'Read-only records entered by your doctors.' : 'All visit records available in your workspace.'}</p></div></div><section className="card"><div className="card-header" style={{flexWrap:'wrap'}}><h3>{filtered.length} record{filtered.length===1?'':'s'}</h3><div className="filter-row no-print"><input className="filter-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search diagnosis, medicine, doctor…"/><input className="filter-input" type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/><button className="btn btn-light" onClick={()=>setSortDir(sortDir==='new'?'old':'new')}><ArrowDownUp size={15}/>{sortDir==='new'?'Newest first':'Oldest first'}</button>{(search || dateFilter) && <button className="link-btn" onClick={()=>{setSearch(''); setDateFilter('');}}>Clear</button>}</div></div><div className="card-body">{loading ? <div className="loading">Loading records…</div> : filtered.length ? <div className="timeline">{filtered.map(r => <div className="timeline-item" key={r.id}><div className="timeline-dot"/><RecordCard record={r} onPrint={()=>printRecord(r)}/></div>)}</div> : <div className="empty">{records.length ? 'No records match your filters.' : 'Records will appear here after a visit is saved.'}</div>}</div></section></div>;
}

function PrescriptionsPage({ patientRole=false }: { patientRole?: boolean }) {
  const auth = useAuth(); const [records, setRecords] = useState<MedicalRecord[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!auth.session) return;
    const load = async () => {
      let patientId: string | undefined;
      if (patientRole) { const { data: patient } = await supabase.from('patients').select('id').eq('user_id', auth.session!.user.id).maybeSingle(); patientId = patient?.id; }
      let q = supabase.from('medical_records').select('*, doctors(doctor_name,hospital,specialization), patients(full_name,patient_id,age,gender,blood_group)').order('visit_date', { ascending: false }).not('medicines', 'is', null);
      if (patientRole && patientId) q = q.eq('patient_id', patientId);
      const { data } = await q; setRecords((data ?? []) as MedicalRecord[]); setLoading(false);
    };
    load();
  }, [patientRole, auth.session]);
  function printPrescription(record: MedicalRecord) {
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    const patientName = record.patients?.full_name ?? 'Patient';
    const patientId = record.patients?.patient_id ?? '—';
    win.document.write(`<html><head><title>MEDI Prescription - ${patientName}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#17324d}h1{color:#0e857e}.rx{font-size:36px;font-weight:800;color:#0e857e;margin:20px 0}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:10px 12px;border-bottom:1px solid #e4eff1;font-size:14px}td:first-child{color:#75909b;width:40%}td:last-child{font-weight:600}.header{display:flex;justify-content:space-between;border-bottom:3px solid #0e857e;padding-bottom:20px;margin-bottom:20px}.brand{font-size:28px;font-weight:800;color:#083b55}</style></head><body><div class="header"><div class="brand">MEDI</div><div>Prescription<br>${formatDate(record.visit_date)}</div></div><h1>Prescription</h1><div class="rx">Rx</div><table><tr><td>Patient</td><td>${patientName}</td></tr><tr><td>Patient ID</td><td>${patientId}</td></tr><tr><td>Doctor</td><td>${record.doctors?.doctor_name ?? '—'}</td></tr><tr><td>Hospital</td><td>${record.doctors?.hospital ?? '—'}</td></tr><tr><td>Date</td><td>${formatDate(record.visit_date)}</td></tr><tr><td>Diagnosis</td><td>${record.diagnosis}</td></tr><tr><td>Medicine</td><td>${record.medicines ?? '—'}</td></tr><tr><td>Dosage</td><td>${record.dosage ?? '—'}</td></tr><tr><td>Frequency</td><td>${record.frequency ?? '—'}</td></tr><tr><td>Duration</td><td>${record.duration ?? '—'}</td></tr><tr><td>Instructions</td><td>${record.prescription ?? '—'}</td></tr></table></body></html>`);
    win.document.close(); win.print();
  }
  const withMeds = records.filter(r => r.medicines || r.prescription);
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">{patientRole ? 'Your prescriptions' : 'Prescription management'}</div><h1 className="page-heading">Prescriptions</h1><p className="muted">{patientRole ? 'Medicines prescribed by your doctors.' : 'All prescriptions with medicine details.'}</p></div></div><section className="card"><div className="card-header"><h3>{withMeds.length} prescription{withMeds.length===1?'':'s'}</h3></div><div className="card-body">{loading ? <div className="loading">Loading prescriptions…</div> : withMeds.length ? <div className="timeline">{withMeds.map(r => <div className="timeline-item" key={r.id}><div className="timeline-dot"/><div className="record-card"><div className="record-top"><div><h4><Pill size={15} style={{verticalAlign:'middle',marginRight:6,color:'#0e857e'}}/>{r.medicines ?? 'Prescription'}</h4><p>{formatDate(r.visit_date)} · {r.doctors?.doctor_name ?? 'Doctor'}{r.doctors?.hospital ? ` · ${r.doctors.hospital}` : ''}</p></div><button className="link-btn no-print" onClick={()=>printPrescription(r)}><FileText size={14}/>Print</button></div><div className="record-fields">{r.dosage && <RecordField label="Dosage" value={r.dosage}/>} {r.frequency && <RecordField label="Frequency" value={r.frequency}/>} {r.duration && <RecordField label="Duration" value={r.duration}/>} {r.prescription && <RecordField label="Instructions" value={r.prescription}/>} {r.diagnosis && <RecordField label="Diagnosis" value={r.diagnosis}/>}</div></div></div>)}</div> : <div className="empty">No prescriptions have been issued yet.</div>}</div></section></div>;
}

function ReportsPage() {
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">Printable documents</div><h1 className="page-heading">Reports</h1><p className="muted">Generate a clean printout of your MEDI record.</p></div><button className="btn btn-primary no-print" onClick={()=>window.print()}><FileText size={16}/>Print this report</button></div><section className="card print-report"><div className="card-body" style={{padding:35}}><div style={{display:'flex',justifyContent:'space-between',borderBottom:'2px solid #0e857e',paddingBottom:20,marginBottom:25}}><div><div className="brand" style={{padding:0,color:'#083b55'}}><div className="brand-mark">M</div><div>MEDI<small style={{color:'#54858a'}}>Medical Easy Data ID</small></div></div></div><div style={{textAlign:'right',fontSize:12,color:'#728e99'}}>Medical report<br/>{new Date().toLocaleDateString()}</div></div><h2 style={{fontSize:24,marginBottom:10}}>Your MEDI report</h2><p className="muted">Use the Medical Records section to review the complete visit-by-visit record. This report is formatted for printing and sharing with your care team.</p><div className="alert" style={{marginTop:25}}>For privacy, only share this report with a trusted healthcare professional.</div></div></section></div>;
}

function DoctorProfile() {
  const auth = useAuth(); const [doctor, setDoctor] = useState<Doctor|null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { if (auth.session) supabase.from('doctors').select('*').eq('user_id', auth.session.user.id).maybeSingle().then(({data}) => { setDoctor(data as Doctor|null); setLoading(false); }); }, [auth.session]);
  return <div className="content"><div className="dashboard-hero"><div><div className="eyebrow">Professional account</div><h1 className="page-heading">Your profile</h1><p className="muted">Your identity as it appears on patient visit records.</p></div></div><section className="card"><div className="card-body">{loading ? <div className="loading">Loading…</div> : <><div style={{display:'flex',gap:16,alignItems:'center',marginBottom:25}}><Avatar name={doctor?.doctor_name ?? auth.profile?.display_name ?? 'Doctor'}/><div><h3>{doctor?.doctor_name ?? auth.profile?.display_name}</h3><p className="muted" style={{margin:'5px 0',fontSize:13}}>{doctor?.specialization || 'Healthcare provider'} · {doctor?.hospital || 'Hospital not provided'}</p></div></div><div className="info-list"><Info label="Doctor name" value={doctor?.doctor_name ?? '—'}/><Info label="Specialization" value={doctor?.specialization ?? 'Not provided'}/><Info label="Hospital / clinic" value={doctor?.hospital ?? '—'}/><Info label="Phone" value={doctor?.phone ?? 'Not provided'}/><Info label="Account email" value={auth.session?.user.email ?? '—'}/></div></>}</div></section></div>;
}

function App() {
  const auth = useAuthLoader(); (window as unknown as { __mediAuth?: AuthState }).__mediAuth = auth;
  if (auth.loading) return <div className="loading">Loading MEDI…</div>;
  return <ToastHost><Routes>
    <Route path="/login" element={auth.session ? <Navigate to={`/${auth.profile?.role ?? 'login'}`}/> : <AuthPage/>}/>
    <Route path="/register/doctor" element={<RegisterPage role="doctor"/>}/>
    <Route path="/register/patient" element={<RegisterPage role="patient"/>}/>
    <Route path="/doctor" element={<Protected role="doctor"><DoctorDashboard/></Protected>}/>
    <Route path="/doctor/search" element={<Protected role="doctor"><SearchPatients/></Protected>}/>
    <Route path="/doctor/scan" element={<Protected role="doctor"><ScanPage/></Protected>}/>
    <Route path="/doctor/records" element={<Protected role="doctor"><RecordsPage/></Protected>}/>
    <Route path="/doctor/prescriptions" element={<Protected role="doctor"><PrescriptionsPage/></Protected>}/>
    <Route path="/doctor/reports" element={<Protected role="doctor"><ReportsPage/></Protected>}/>
    <Route path="/doctor/profile" element={<Protected role="doctor"><DoctorProfile/></Protected>}/>
    <Route path="/doctor/patient/:id" element={<Protected role="doctor"><PatientProfileView doctorView/></Protected>}/>
    <Route path="/doctor/patient/:id/add-record" element={<Protected role="doctor"><AddRecord/></Protected>}/>
    <Route path="/patient" element={<Protected role="patient"><PatientDashboard/></Protected>}/>
    <Route path="/patient/profile" element={<Protected role="patient"><PatientProfileView/></Protected>}/>
    <Route path="/patient/qr" element={<Protected role="patient"><PatientQrPage/></Protected>}/>
    <Route path="/patient/records" element={<Protected role="patient"><RecordsPage patientRole/></Protected>}/>
    <Route path="/patient/history" element={<Protected role="patient"><RecordsPage patientRole/></Protected>}/>
    <Route path="/patient/prescriptions" element={<Protected role="patient"><PrescriptionsPage patientRole/></Protected>}/>
    <Route path="/patient/reports" element={<Protected role="patient"><ReportsPage/></Protected>}/>
    <Route path="*" element={<Navigate to={auth.session ? `/${auth.profile?.role ?? 'login'}` : '/login'} replace/>}/>
  </Routes></ToastHost>;
}

export default App;
