import { useEffect, useMemo, useState } from 'react';

type User = { id: string; name: string; email: string };
type Mode = 'brainstorm' | 'decision' | 'plan' | 'analysis';
type Profile = 'balanced' | 'ambitious' | 'cautious';
type Card = { label: string; title: string; content: string };
type Session = { id: string; projectId?: string; title: string; prompt: string; mode: Mode; profile: Profile; summary: string; cards: Card[]; createdAt: string };
type Member = { userId: string; role: string; user: User };
type Project = { id: string; name: string; description: string; members: Member[]; createdAt: string };
type Message = { id: string; author: string; role: string; text: string; createdAt: string };

const API = '/api';
const modeMeta: Record<Mode, { label: string; accent: string }> = {
  brainstorm: { label: 'Brainstorm', accent: '#9c7bff' },
  decision: { label: 'Decision', accent: '#5bc0ff' },
  plan: { label: 'Plan', accent: '#4fd1a5' },
  analysis: { label: 'Analysis', accent: '#f4b860' }
};
const profiles: Record<Profile, string> = { balanced: 'Balanced', ambitious: 'Ambitious', cautious: 'Cautious' };
const presets = ['Product launch', 'Decision review', 'Team roadmap', 'Research insight'];
const presetPrompts: Record<string, string> = {
  'Product launch': 'Design a customer-friendly AI launch plan for a new product in a crowded market.',
  'Decision review': 'Compare two product strategies and decide which one best supports sustainable growth.',
  'Team roadmap': 'Build a practical roadmap for a high-impact initiative with limited engineering capacity.',
  'Research insight': 'Analyze user behavior signals and decide whether a new feature is worth pursuing.'
};

async function request<T>(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('mindforge-token');
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data as T;
}

function AuthScreen({ onSignedIn }: { onSignedIn: (user: User, token: string) => void }) {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try {
      const data = await request<{ user: User; token: string }>(registering ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(registering ? { name, email, password } : { email, password }) });
      localStorage.setItem('mindforge-token', data.token); onSignedIn(data.user, data.token);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to authenticate.'); }
  };
  return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">M</div><p className="eyebrow">Private thinking workspace</p><h1>{registering ? 'Create your MindForge account' : 'Welcome back'}</h1><p className="muted">Keep your ideas, decisions, and team conversations in one focused space.</p><form onSubmit={submit}>{registering && <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" /><input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (6+ characters)" />{error && <div className="error-box">{error}</div>}<button className="primary">{registering ? 'Create account' : 'Sign in'}</button></form><button className="link-button" onClick={() => setRegistering(!registering)}>{registering ? 'Already have an account? Sign in' : 'Create a new account'}</button></section></main>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('Build a values-driven AI assistant for product teams');
  const [mode, setMode] = useState<Mode>('brainstorm');
  const [profile, setProfile] = useState<Profile>('balanced');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [message, setMessage] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadWorkspace() {
    const data = await request<{ projects: Project[] }>('/projects');
    setProjects(data.projects); const project = data.projects[0] || null; setActiveProject(project);
    if (project) { const [saved, chat] = await Promise.all([request<{ sessions: Session[] }>(`/projects/${project.id}/sessions`), request<{ messages: Message[] }>(`/projects/${project.id}/messages`)]); setSessions(saved.sessions); setMessages(chat.messages); setActiveSession(saved.sessions[0] || null); }
  }
  useEffect(() => { const token = localStorage.getItem('mindforge-token'); if (token) request<{ user: User }>('/me').then((data) => { setUser(data.user); loadWorkspace(); }).catch(() => localStorage.removeItem('mindforge-token')); }, []);

  const metrics = useMemo(() => ({ sessions: sessions.length, cards: sessions.reduce((sum, item) => sum + item.cards.length, 0), members: activeProject?.members.length || 0 }), [sessions, activeProject]);
  const signOut = () => { localStorage.removeItem('mindforge-token'); setUser(null); };
  const selectProject = async (project: Project) => { setActiveProject(project); const [saved, chat] = await Promise.all([request<{ sessions: Session[] }>(`/projects/${project.id}/sessions`), request<{ messages: Message[] }>(`/projects/${project.id}/messages`)]); setSessions(saved.sessions); setMessages(chat.messages); setActiveSession(saved.sessions[0] || null); };
  const createProject = async () => { const name = window.prompt('Workspace name', 'New strategy workspace'); if (!name) return; const data = await request<{ project: Project }>('/projects', { method: 'POST', body: JSON.stringify({ name, description: 'A shared space for structured thinking.' }) }); setProjects((items) => [data.project, ...items]); setActiveProject(data.project); setSessions([]); setMessages([]); setActiveSession(null); };
  const generate = async () => { if (!activeProject || !prompt.trim()) return; setLoading(true); setError(''); try { const generated = await request<{ title: string; summary: string; cards: Card[] }>('/generate', { method: 'POST', body: JSON.stringify({ prompt, mode, profile }) }); const data = await request<{ session: Session }>(`/projects/${activeProject.id}/sessions`, { method: 'POST', body: JSON.stringify({ prompt, mode, profile, ...generated }) }); setSessions((items) => [data.session, ...items]); setActiveSession(data.session); } catch (err) { setError(err instanceof Error ? err.message : 'Generation failed.'); } finally { setLoading(false); } };
  const sendMessage = async (event: React.FormEvent) => { event.preventDefault(); if (!activeProject || !message.trim()) return; try { const data = await request<{ messages: Message[] }>(`/projects/${activeProject.id}/messages`, { method: 'POST', body: JSON.stringify({ text: message }) }); setMessages((items) => [...items, ...data.messages]); setMessage(''); } catch (err) { setError(err instanceof Error ? err.message : 'Message failed.'); } };
  const invite = async () => { if (!activeProject || !inviteEmail.trim()) return; try { const data = await request<{ project: Project }>(`/projects/${activeProject.id}/members`, { method: 'POST', body: JSON.stringify({ email: inviteEmail }) }); setActiveProject(data.project); setProjects((items) => items.map((item) => item.id === data.project.id ? data.project : item)); setInviteEmail(''); } catch (err) { setError(err instanceof Error ? err.message : 'Invite failed.'); } };
  const exportNote = () => { if (!activeSession) return; const text = `# ${activeSession.title}\n\n${activeSession.summary}\n\n${activeSession.cards.map((card) => `## ${card.title}\n${card.content}`).join('\n\n')}`; const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'mindforge-session.md'; anchor.click(); URL.revokeObjectURL(url); };

  if (!user) return <AuthScreen onSignedIn={(nextUser) => { setUser(nextUser); loadWorkspace(); }} />;

  return <div className="app-shell"><aside className="sidebar"><div className="brand-block"><div className="brand-mark">M</div><div><p className="eyebrow">AI workspace</p><h1>MindForge</h1></div></div><div className="user-bar"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><button className="icon-button" onClick={signOut} title="Sign out">↪</button></div><div className="panel"><div className="section-heading"><h2>Workspaces</h2><button className="icon-button" onClick={createProject}>+</button></div>{projects.map((project) => <button className={`project-item ${activeProject?.id === project.id ? 'selected' : ''}`} key={project.id} onClick={() => selectProject(project)}><strong>{project.name}</strong><span>{project.members.length} members</span></button>)}</div><div className="panel composer"><label>Thinking prompt</label><textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} /><div className="field-row"><select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>{Object.entries(modeMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select><select value={profile} onChange={(e) => setProfile(e.target.value as Profile)}>{Object.entries(profiles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><select defaultValue="" onChange={(e) => { if (e.target.value) setPrompt(presetPrompts[e.target.value]); }}><option value="">Prompt template</option>{presets.map((preset) => <option key={preset} value={preset}>{preset}</option>)}</select><button className="primary" onClick={generate} disabled={loading || !activeProject}>{loading ? 'Thinking...' : 'Generate insight map'}</button>{error && <div className="error-box">{error}</div>}</div><div className="metrics"><div><strong>{metrics.sessions}</strong><span>Sessions</span></div><div><strong>{metrics.cards}</strong><span>Insight cards</span></div><div><strong>{metrics.members}</strong><span>Members</span></div></div></aside><main className="content"><header className="topbar"><div><p className="eyebrow">{activeProject?.name || 'Workspace'}</p><h2>{activeSession?.title || 'New thought board'}</h2></div><button className="secondary" onClick={exportNote} disabled={!activeSession}>Export note</button></header>{activeSession ? <section className="summary-card" style={{ borderTop: `3px solid ${modeMeta[activeSession.mode].accent}` }}><div className="summary-header"><div><p className="eyebrow">{modeMeta[activeSession.mode].label} session</p><h3>{activeSession.title}</h3></div><span className="chip">{profiles[activeSession.profile]}</span></div><p>{activeSession.summary}</p><div className="card-grid">{activeSession.cards.map((card) => <article className="insight-card" key={`${activeSession.id}-${card.title}`}><span className="label-pill">{card.label}</span><h4>{card.title}</h4><p>{card.content}</p></article>)}</div></section> : <section className="empty-panel"><h3>Choose a workspace and start thinking</h3><p>Generate a map, save it to your project, and invite teammates to continue the reasoning together.</p></section>}<section className="collaboration-grid"><div className="panel thread-panel"><div className="section-heading"><div><p className="eyebrow">Shared thread</p><h3>Team conversation</h3></div><span className="chip">{messages.length} messages</span></div><div className="messages">{messages.length ? messages.map((item) => <div className={`message ${item.role}`} key={item.id}><span className="message-author">{item.author}</span><p>{item.text}</p></div>) : <p className="muted">No messages yet. Ask the team a question about this workspace.</p>}</div><form className="message-form" onSubmit={sendMessage}><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask a follow-up or leave a note..." /><button className="primary">Send</button></form></div><div className="panel members-panel"><p className="eyebrow">Collaboration</p><h3>Workspace members</h3>{activeProject?.members.map((member) => <div className="member" key={member.userId}><span className="avatar">{member.user.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.user.name}</strong><small>{member.user.email}</small></div><span className="role">{member.role}</span></div>)}<div className="invite"><input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Teammate email" /><button className="secondary" onClick={invite}>Invite</button></div></div></section></main></div>;
}
