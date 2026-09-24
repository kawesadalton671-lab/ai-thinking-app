import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const DATA_FILE = path.join(DATA_DIR, 'mindforge.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const initialData = { users: [], sessions: [], projects: [], messages: [], invites: [] };
let db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : initialData;
const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const hash = (password, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, digest: crypto.scryptSync(password, salt, 64).toString('hex') });
const verify = (password, user) => crypto.timingSafeEqual(Buffer.from(hash(password, user.salt).digest, 'hex'), Buffer.from(user.passwordDigest, 'hex'));
const tokens = new Map();
const modeLabels = { brainstorm: 'Brainstorm', decision: 'Decision', plan: 'Plan', analysis: 'Analysis' };

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const userId = tokens.get(token);
  if (!userId) return res.status(401).json({ error: 'Sign in required.' });
  const user = db.users.find((item) => item.id === userId);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  req.user = user;
  next();
}

function publicUser(user) { return { id: user.id, name: user.name, email: user.email }; }
function projectForUser(project, userId) { return project && project.members.some((member) => member.userId === userId); }
function publicProject(project) {
  return { ...project, members: project.members.map((member) => ({ ...member, user: publicUser(db.users.find((user) => user.id === member.userId) || { id: member.userId, name: 'Unknown', email: '' }) })) };
}

function cardsFor(prompt, mode) {
  const topic = prompt.trim() || 'a new opportunity';
  const definitions = {
    brainstorm: [['Core idea', 'Opportunity framing'], ['Creative direction', 'Divergent options'], ['Risk signal', 'Frictions to watch'], ['Action path', 'Fastest next move']],
    decision: [['Criteria', 'What matters most'], ['Upside', 'Strongest option'], ['Risk', 'Failure mode'], ['Recommendation', 'Decision call']],
    plan: [['Outcome', 'Success target'], ['Milestones', 'Execution roadmap'], ['Dependencies', 'Support needed'], ['Cadence', 'Feedback loop']],
    analysis: [['Signal', 'Current pattern'], ['Evidence', 'What supports it'], ['Interpretation', 'Meaning'], ['Conclusion', 'Next reading']]
  };
  return definitions[mode].map(([label, title], index) => ({
    label,
    title,
    content: [
      `Frame ${topic} around a clear user need, measurable value, and the context that makes the opportunity worth pursuing.`,
      `Explore several angles for ${topic}, then test the one with the strongest signal using the smallest practical experiment.`,
      `Review adoption friction, hidden dependencies, unclear assumptions, and the cost of being wrong before moving ahead.`,
      `Turn the insight into one concrete next action with an owner, a short timeline, and evidence that would change the direction.`
    ][index]
  }));
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || String(password).length < 6) return res.status(400).json({ error: 'Name, email, and a password of at least 6 characters are required.' });
  const normalizedEmail = String(email).trim().toLowerCase();
  if (db.users.some((user) => user.email === normalizedEmail)) return res.status(409).json({ error: 'An account with that email already exists.' });
  const credentials = hash(String(password));
  const user = { id: id(), name: String(name).trim(), email: normalizedEmail, salt: credentials.salt, passwordDigest: credentials.digest, createdAt: now() };
  db.users.push(user); save();
  const token = id(); tokens.set(token, user.id);
  res.status(201).json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.users.find((item) => item.email === String(email || '').trim().toLowerCase());
  if (!user || !verify(String(password || ''), user)) return res.status(401).json({ error: 'Invalid email or password.' });
  const token = id(); tokens.set(token, user.id);
  res.json({ token, user: publicUser(user) });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/projects', auth, (req, res) => {
  res.json({ projects: db.projects.filter((project) => projectForUser(project, req.user.id)).map(publicProject) });
});

app.post('/api/projects', auth, (req, res) => {
  const project = { id: id(), name: String(req.body?.name || 'Untitled workspace').trim(), description: String(req.body?.description || '').trim(), createdAt: now(), members: [{ userId: req.user.id, role: 'owner', joinedAt: now() }] };
  db.projects.unshift(project); save(); res.status(201).json({ project: publicProject(project) });
});

app.post('/api/projects/:projectId/sessions', auth, (req, res) => {
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project || !projectForUser(project, req.user.id)) return res.status(404).json({ error: 'Project not found.' });
  const { prompt, mode = 'brainstorm', profile = 'balanced', title, summary, cards } = req.body || {};
  const session = { id: id(), projectId: project.id, authorId: req.user.id, title: title || String(prompt || 'Untitled thought').slice(0, 48), prompt: String(prompt || ''), mode, profile, summary: summary || `A ${profile} ${modeLabels[mode] || 'thinking'} session.`, cards: Array.isArray(cards) ? cards : cardsFor(String(prompt || ''), mode), createdAt: now() };
  db.sessions.unshift(session); save(); res.status(201).json({ session });
});

app.get('/api/projects/:projectId/sessions', auth, (req, res) => {
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project || !projectForUser(project, req.user.id)) return res.status(404).json({ error: 'Project not found.' });
  res.json({ sessions: db.sessions.filter((session) => session.projectId === project.id).slice(0, 50) });
});

app.post('/api/projects/:projectId/members', auth, (req, res) => {
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project || !projectForUser(project, req.user.id) || !project.members.some((member) => member.userId === req.user.id && member.role === 'owner')) return res.status(403).json({ error: 'Only project owners can invite members.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const invited = db.users.find((user) => user.email === email);
  if (!invited) return res.status(404).json({ error: 'That user must create an account before they can join.' });
  if (!project.members.some((member) => member.userId === invited.id)) project.members.push({ userId: invited.id, role: 'editor', joinedAt: now() });
  save(); res.json({ project: publicProject(project) });
});

app.get('/api/projects/:projectId/messages', auth, (req, res) => {
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project || !projectForUser(project, req.user.id)) return res.status(404).json({ error: 'Project not found.' });
  res.json({ messages: db.messages.filter((message) => message.projectId === project.id) });
});

app.post('/api/projects/:projectId/messages', auth, (req, res) => {
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project || !projectForUser(project, req.user.id)) return res.status(404).json({ error: 'Project not found.' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
  const message = { id: id(), projectId: project.id, userId: req.user.id, author: req.user.name, role: 'user', text, createdAt: now() };
  db.messages.push(message);
  const assistant = { id: id(), projectId: project.id, userId: 'assistant', author: 'MindForge AI', role: 'assistant', text: `A useful next step is to clarify the assumption behind “${text}”, identify what evidence would change your mind, and choose a small experiment to learn quickly.`, createdAt: now() };
  db.messages.push(assistant); save(); res.status(201).json({ messages: [message, assistant] });
});

app.post('/api/generate', auth, (req, res) => {
  const { prompt, mode = 'brainstorm', profile = 'balanced' } = req.body || {};
  if (!String(prompt || '').trim()) return res.status(400).json({ error: 'Prompt is required.' });
  const cleanPrompt = String(prompt).trim();
  res.json({ title: cleanPrompt.slice(0, 48), summary: `A ${profile} ${modeLabels[mode] || 'thinking'} session focused on ${cleanPrompt}.`, cards: cardsFor(cleanPrompt, mode) });
});

app.listen(PORT, () => console.log(`MindForge API running on http://localhost:${PORT}`));
