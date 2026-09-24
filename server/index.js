import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();
const production = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const DATA_FILE = path.join(DATA_DIR, 'mindforge.json');
const JWT_SECRET = process.env.AUTH_SECRET;
if (production && (!JWT_SECRET || JWT_SECRET.length < 32)) throw new Error('AUTH_SECRET must be set to a random value of at least 32 characters in production.');
const secret = JWT_SECRET || 'development-only-secret-change-me';
fs.mkdirSync(DATA_DIR, { recursive: true });
const initialData = { users: [], sessions: [], projects: [], messages: [] };
let db;
try { db = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : initialData; } catch { db = initialData; }
const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), { mode: 0o600 });
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const hash = (password, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, digest: crypto.scryptSync(password, salt, 64).toString('hex') });
const verify = (password, user) => { const actual = Buffer.from(hash(password, user.salt).digest, 'hex'); const expected = Buffer.from(user.passwordDigest, 'hex'); return actual.length === expected.length && crypto.timingSafeEqual(actual, expected); };
const b64 = (value) => Buffer.from(value).toString('base64url');
function signToken(userId) { const payload = b64(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 })); const signature = b64(crypto.createHmac('sha256', secret).update(payload).digest()); return `${payload}.${signature}`; }
function readToken(token) { try { const [payload, signature] = String(token || '').split('.'); if (!payload || !signature) return null; const expected = b64(crypto.createHmac('sha256', secret).update(payload).digest()); if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null; const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return data.exp > Math.floor(Date.now() / 1000) ? data.sub : null; } catch { return null; } }
function publicUser(user) { return { id: user.id, name: user.name, email: user.email }; }
function parseCookies(header = '') { return Object.fromEntries(header.split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key, value]) => key && value)); }
function setAuthCookie(res, token) { res.setHeader('Set-Cookie', `mindforge_token=${encodeURIComponent(token)}; HttpOnly; ${production ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=604800`); }
function clearAuthCookie(res) { res.setHeader('Set-Cookie', `mindforge_token=; HttpOnly; ${production ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`); }
function projectForUser(project, userId) { return project?.members.some((member) => member.userId === userId); }
function publicProject(project) { return { ...project, members: project.members.map((member) => ({ ...member, user: publicUser(db.users.find((user) => user.id === member.userId) || { id: member.userId, name: 'Unknown', email: '' }) })) }; }
function cardsFor(prompt, mode) { const topic = prompt.trim() || 'a new opportunity'; const labels = { brainstorm: [['Core idea', 'Opportunity framing'], ['Creative direction', 'Divergent options'], ['Risk signal', 'Frictions to watch'], ['Action path', 'Fastest next move']], decision: [['Criteria', 'What matters most'], ['Upside', 'Strongest option'], ['Risk', 'Failure mode'], ['Recommendation', 'Decision call']], plan: [['Outcome', 'Success target'], ['Milestones', 'Execution roadmap'], ['Dependencies', 'Support needed'], ['Cadence', 'Feedback loop']], analysis: [['Signal', 'Current pattern'], ['Evidence', 'What supports it'], ['Interpretation', 'Meaning'], ['Conclusion', 'Next reading']] }; const copy = [`Frame ${topic} around a clear user need and measurable value.`, `Explore several angles for ${topic}, then test the one with the strongest signal.`, 'Review adoption friction, hidden dependencies, unclear assumptions, and the cost of being wrong.', 'Turn the insight into one concrete next action with an owner and a short timeline.']; return (labels[mode] || labels.brainstorm).map(([label, title], index) => ({ label, title, content: copy[index] })); }

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.APP_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

function auth(req, res, next) { const cookies = parseCookies(req.headers.cookie); const header = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); const userId = readToken(cookies.mindforge_token || header); const user = db.users.find((item) => item.id === userId); if (!user) return res.status(401).json({ error: 'Sign in required.' }); req.user = user; next(); }
function projectOr404(req, res) { const project = db.projects.find((item) => item.id === req.params.projectId); if (!project || !projectForUser(project, req.user.id)) { res.status(404).json({ error: 'Project not found.' }); return null; } return project; }

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '3.1.0' }));
app.post('/api/auth/register', authLimit, (req, res) => { const name = String(req.body?.name || '').trim(); const email = String(req.body?.email || '').trim().toLowerCase(); const password = String(req.body?.password || ''); if (name.length < 2 || name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Use a valid name, email, and password of 8–200 characters.' }); if (db.users.some((user) => user.email === email)) return res.status(409).json({ error: 'An account with that email already exists.' }); const credentials = hash(password); const user = { id: id(), name, email, salt: credentials.salt, passwordDigest: credentials.digest, createdAt: now() }; db.users.push(user); const token = signToken(user.id); save(); setAuthCookie(res, token); res.status(201).json({ token, user: publicUser(user) }); });
app.post('/api/auth/login', authLimit, (req, res) => { const email = String(req.body?.email || '').trim().toLowerCase(); const user = db.users.find((item) => item.email === email); if (!user || !verify(String(req.body?.password || ''), user)) return res.status(401).json({ error: 'Invalid email or password.' }); const token = signToken(user.id); setAuthCookie(res, token); res.json({ token, user: publicUser(user) }); });
app.post('/api/auth/logout', auth, (_req, res) => { clearAuthCookie(res); res.status(204).end(); });
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/api/projects', auth, (req, res) => res.json({ projects: db.projects.filter((project) => projectForUser(project, req.user.id)).map(publicProject) }));
app.post('/api/projects', auth, (req, res) => { const name = String(req.body?.name || 'Untitled workspace').trim().slice(0, 100); const description = String(req.body?.description || '').trim().slice(0, 500); const project = { id: id(), name, description, createdAt: now(), members: [{ userId: req.user.id, role: 'owner', joinedAt: now() }] }; db.projects.unshift(project); save(); res.status(201).json({ project: publicProject(project) }); });
app.get('/api/projects/:projectId/sessions', auth, (req, res) => { const project = projectOr404(req, res); if (!project) return; res.json({ sessions: db.sessions.filter((session) => session.projectId === project.id).slice(0, 100) }); });
app.post('/api/projects/:projectId/sessions', auth, (req, res) => { const project = projectOr404(req, res); if (!project) return; const prompt = String(req.body?.prompt || '').trim().slice(0, 10000); if (!prompt) return res.status(400).json({ error: 'Prompt is required.' }); const mode = ['brainstorm', 'decision', 'plan', 'analysis'].includes(req.body?.mode) ? req.body.mode : 'brainstorm'; const session = { id: id(), projectId: project.id, authorId: req.user.id, title: String(req.body?.title || prompt.slice(0, 48)).slice(0, 100), prompt, mode, profile: ['balanced', 'ambitious', 'cautious'].includes(req.body?.profile) ? req.body.profile : 'balanced', summary: String(req.body?.summary || `A ${mode} session focused on ${prompt}.`).slice(0, 1000), cards: Array.isArray(req.body?.cards) ? req.body.cards.slice(0, 12) : cardsFor(prompt, mode), createdAt: now() }; db.sessions.unshift(session); save(); res.status(201).json({ session }); });
app.get('/api/projects/:projectId/messages', auth, (req, res) => { const project = projectOr404(req, res); if (!project) return; res.json({ messages: db.messages.filter((message) => message.projectId === project.id).slice(-200) }); });
app.post('/api/projects/:projectId/messages', auth, (req, res) => { const project = projectOr404(req, res); if (!project) return; const text = String(req.body?.text || '').trim().slice(0, 5000); if (!text) return res.status(400).json({ error: 'Message cannot be empty.' }); const message = { id: id(), projectId: project.id, userId: req.user.id, author: req.user.name, role: 'user', text, createdAt: now() }; const assistant = { id: id(), projectId: project.id, userId: 'assistant', author: 'MindForge AI', role: 'assistant', text: `Clarify the assumption behind “${text}”, identify evidence that would change your mind, and choose a small experiment.`, createdAt: now() }; db.messages.push(message, assistant); save(); res.status(201).json({ messages: [message, assistant] }); });
app.post('/api/projects/:projectId/members', auth, (req, res) => { const project = projectOr404(req, res); if (!project) return; if (!project.members.some((member) => member.userId === req.user.id && member.role === 'owner')) return res.status(403).json({ error: 'Only project owners can invite members.' }); const email = String(req.body?.email || '').trim().toLowerCase(); const invited = db.users.find((user) => user.email === email); if (!invited) return res.status(404).json({ error: 'That user must create an account before joining.' }); if (!project.members.some((member) => member.userId === invited.id)) project.members.push({ userId: invited.id, role: 'editor', joinedAt: now() }); save(); res.json({ project: publicProject(project) }); });
app.post('/api/generate', auth, (req, res) => { const prompt = String(req.body?.prompt || '').trim().slice(0, 10000); if (!prompt) return res.status(400).json({ error: 'Prompt is required.' }); const mode = ['brainstorm', 'decision', 'plan', 'analysis'].includes(req.body?.mode) ? req.body.mode : 'brainstorm'; res.json({ title: prompt.slice(0, 48), summary: `A ${req.body?.profile || 'balanced'} ${mode} session focused on ${prompt}.`, cards: cardsFor(prompt, mode) }); });

if (production) app.use(express.static(path.resolve('dist'), { maxAge: '1d', index: false }));
app.use((_req, res) => production ? res.sendFile(path.resolve('dist/index.html')) : res.status(404).json({ error: 'Not found.' }));
const server = app.listen(PORT, () => console.log(`MindForge running on port ${PORT}`));
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
