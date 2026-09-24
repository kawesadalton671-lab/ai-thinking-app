import { useEffect, useMemo, useState } from 'react';

type Mode = 'brainstorm' | 'decision' | 'plan' | 'analysis';
type Profile = 'balanced' | 'ambitious' | 'cautious';

type ThoughtCard = {
  label: string;
  title: string;
  content: string;
};

type Session = {
  id: number;
  title: string;
  mode: Mode;
  profile: Profile;
  prompt: string;
  summary: string;
  cards: ThoughtCard[];
  createdAt: string;
  tags: string[];
};

type Project = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  sessions: Session[];
};

const MODE_META: Record<Mode, { label: string; accent: string }> = {
  brainstorm: { label: 'Brainstorm', accent: '#9c7bff' },
  decision: { label: 'Decision', accent: '#5bc0ff' },
  plan: { label: 'Plan', accent: '#4fd1a5' },
  analysis: { label: 'Analysis', accent: '#f4b860' }
};

const PROFILE_META: Record<Profile, string> = {
  balanced: 'Balanced',
  ambitious: 'Ambitious',
  cautious: 'Cautious'
};

const STORAGE_KEY = 'mindforge-sessions-v2';
const PROJECT_KEY = 'mindforge-projects-v2';

const presetPrompts = [
  {
    label: 'Product launch',
    value: 'Design a customer-friendly AI launch plan for a new product in a crowded market.'
  },
  {
    label: 'Decision review',
    value: 'Compare two product strategies and decide which one best supports sustainable growth.'
  },
  {
    label: 'Team roadmap',
    value: 'Build a practical roadmap for a high-impact initiative with limited engineering capacity.'
  },
  {
    label: 'Research insight',
    value: 'Analyze user behavior signals and decide whether a new feature is worth pursuing.'
  }
];

function titleFromPrompt(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) return 'Untitled thought';
  return trimmed.slice(0, 48).trim();
}

function inferTags(prompt: string, mode: Mode): string[] {
  const words = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 5);

  const tags = [...new Set([...words, mode])];
  return tags.slice(0, 4);
}

function buildLocalCards(prompt: string, mode: Mode): ThoughtCard[] {
  const cleanPrompt = prompt.trim() || 'a new opportunity';
  const words = cleanPrompt.split(/\s+/).filter(Boolean);
  const lead = words.slice(0, 3).join(' ') || 'the challenge';

  if (mode === 'brainstorm') {
    return [
      {
        label: 'Core idea',
        title: 'Opportunity framing',
        content: `Frame ${cleanPrompt} as a meaningful user problem and highlight the value it creates for people who feel the pain most strongly.`
      },
      {
        label: 'Creative direction',
        title: 'Divergent options',
        content: `Generate a few unexpected angles around ${lead}, then test which ones create the strongest emotional pull without increasing complexity too much.`
      },
      {
        label: 'Risk signal',
        title: 'Frictions to watch',
        content: `Check for trust issues, adoption friction, unclear incentives, and hidden dependencies that could slow momentum before launch.`
      },
      {
        label: 'Action path',
        title: 'Fastest next move',
        content: `Run a concept test with a narrow audience, gather feedback, and use the response to sharpen the strongest idea before expanding scope.`
      }
    ];
  }

  if (mode === 'decision') {
    return [
      {
        label: 'Criteria',
        title: 'What matters most',
        content: `Evaluate ${cleanPrompt} against cost, speed, strategic alignment, customer impact, and future flexibility before locking in a direction.`
      },
      {
        label: 'Upside',
        title: 'Strongest option',
        content: `Choose the path that creates the best balance of short-term momentum and long-term adaptability, especially if user feedback is likely to evolve.`
      },
      {
        label: 'Risk',
        title: 'Failure mode',
        content: `The biggest failure mode is choosing a low-effort solution that feels attractive today but becomes costly or brittle after adoption.`
      },
      {
        label: 'Recommendation',
        title: 'Decision call',
        content: `Proceed with the option that maximizes signal-to-effort, then validate it through a low-risk pilot before scaling to a broader rollout.`
      }
    ];
  }

  if (mode === 'plan') {
    return [
      {
        label: 'Outcome',
        title: 'Success target',
        content: `Define the measurable outcome for ${cleanPrompt}, including what success looks like, what success does not look like, and the time horizon for change.`
      },
      {
        label: 'Milestones',
        title: 'Execution roadmap',
        content: `Break the work into three to five checkpoints: discovery, prototype, validation, refinement, and final release, with explicit review points.`
      },
      {
        label: 'Dependencies',
        title: 'Support needed',
        content: `Identify teams, tools, stakeholders, research, and approvals required to keep the plan realistic and avoid avoidable blockers.`
      },
      {
        label: 'Cadence',
        title: 'Feedback loop',
        content: `Review progress weekly, surface risk early, and protect time for iteration so the plan stays aligned with reality instead of assumptions.`
      }
    ];
  }

  return [
    {
      label: 'Signal',
      title: 'Current pattern',
      content: `The strongest signal behind ${cleanPrompt} is a combination of user friction, strategic relevance, and the potential to create measurable value if addressed well.`
    },
    {
      label: 'Evidence',
      title: 'What supports it',
      content: `Look for the clearest evidence, user statements, market cues, or operational patterns that support the interpretation and distinguish it from noise.`
    },
    {
      label: 'Interpretation',
      title: 'Meaning',
      content: `The main takeaway is that the idea is promising only if the underlying need is real, urgent, and likely to repeat across a meaningful group of users.`
    },
    {
      label: 'Conclusion',
      title: 'Next reading',
      content: `Treat the current idea as a valuable hypothesis, then test it with focused evidence before committing resources or changing priorities.`
    }
  ];
}

function buildSummary(prompt: string, mode: Mode, profile: Profile) {
  const normalized = prompt.trim() || 'a new opportunity';
  return `A ${PROFILE_META[profile]} ${MODE_META[mode].label.toLowerCase()} session focused on ${normalized}.`;
}

function buildProjectFromSession(session: Session): Project {
  return {
    id: `project-${Date.now()}`,
    name: 'Strategy Workspace',
    description: 'Prompt-driven idea development and decision support.',
    createdAt: new Date().toISOString(),
    sessions: [session]
  };
}

function getInitialProjects(): Project[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(PROJECT_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

function getInitialSessions(): Session[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as Session[];
  } catch {
    return [];
  }
}

function makeSession(prompt: string, mode: Mode, profile: Profile, cards: ThoughtCard[], titleOverride?: string): Session {
  const title = titleOverride || titleFromPrompt(prompt);
  return {
    id: Date.now() + Math.random(),
    title,
    mode,
    profile,
    prompt: prompt.trim() || 'A new opportunity',
    summary: buildSummary(prompt, mode, profile),
    cards,
    createdAt: new Date().toISOString(),
    tags: inferTags(prompt, mode)
  };
}

function persistSessionToProject(projects: Project[], projectId: string | null, session: Session): Project[] {
  const safeProjectId = projectId || 'workspace-default';
  const existingIndex = projects.findIndex((project) => project.id === safeProjectId);

  if (existingIndex >= 0) {
    const nextProjects = [...projects];
    const target = nextProjects[existingIndex];
    const sessions = [session, ...target.sessions].slice(0, 10);
    nextProjects[existingIndex] = { ...target, sessions, description: target.description || 'Updated project workspace.' };
    return nextProjects;
  }

  const newProject: Project = {
    id: safeProjectId,
    name: 'Strategy Workspace',
    description: 'Updated project workspace.',
    createdAt: new Date().toISOString(),
    sessions: [session]
  };

  return [newProject, ...projects];
}

export default function App() {
  const [prompt, setPrompt] = useState('Build a values-driven AI assistant for product teams');
  const [mode, setMode] = useState<Mode>('brainstorm');
  const [profile, setProfile] = useState<Profile>('balanced');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('Strategy Workspace');
  const [projectDescription, setProjectDescription] = useState('Prompt-driven idea development and decision support.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadedProjects = getInitialProjects();
    const loadedSessions = getInitialSessions();

    if (loadedProjects.length > 0) {
      setProjects(loadedProjects);
      setActiveProjectId(loadedProjects[0].id);
      setProjectName(loadedProjects[0].name);
      setProjectDescription(loadedProjects[0].description);
    } else {
      const workspace = buildProjectFromSession(
        makeSession('Start with a focused challenge.', 'brainstorm', 'balanced', buildLocalCards('Start with a focused challenge.', 'brainstorm'))
      );
      setProjects([workspace]);
      setActiveProjectId(workspace.id);
      setProjectName(workspace.name);
      setProjectDescription(workspace.description);
    }

    if (loadedSessions.length > 0) {
      setSessions(loadedSessions);
      setActiveSession(loadedSessions[0]);
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem(PROJECT_KEY, JSON.stringify(projects));
    }
  }, [projects]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null,
    [projects, activeProjectId]
  );

  const activeSummary = useMemo(() => {
    if (!activeSession) return null;
    return `${activeSession.title} • ${MODE_META[activeSession.mode].label}`;
  }, [activeSession]);

  const projectMetrics = useMemo(() => {
    if (!activeProject) return { totalSessions: 0, totalCards: 0, uniqueModes: 0, lastUpdated: '—' };

    const totalSessions = activeProject.sessions.length;
    const totalCards = activeProject.sessions.reduce((sum, session) => sum + session.cards.length, 0);
    const uniqueModes = new Set(activeProject.sessions.map((session) => session.mode)).size;
    const lastUpdated = activeProject.sessions[0]?.createdAt
      ? new Date(activeProject.sessions[0].createdAt).toLocaleDateString()
      : '—';

    return { totalSessions, totalCards, uniqueModes, lastUpdated };
  }, [activeProject]);

  function createProject() {
    const trimmed = projectName.trim() || 'New Strategy Workspace';
    const project: Project = {
      id: `project-${Date.now()}`,
      name: trimmed,
      description: projectDescription.trim() || 'Prompt-driven idea development and decision support.',
      createdAt: new Date().toISOString(),
      sessions: []
    };

    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.id);
  }

  function saveCurrentSessionToProject() {
    if (!activeSession) return;

    setProjects((current) => persistSessionToProject(current, activeProjectId, activeSession));
    const targetProject = activeProject || { id: activeProjectId || 'workspace-default', name: projectName, description: projectDescription, createdAt: new Date().toISOString(), sessions: [] };
    setProjectName(targetProject.name);
    setProjectDescription(targetProject.description);
  }

  async function generateSession() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError('Add a prompt before generating the thought map.');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmedPrompt, mode, profile })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to generate an AI thinking map.');
      }

      const cards = Array.isArray(data.cards) && data.cards.length > 0 ? data.cards : buildLocalCards(trimmedPrompt, mode);
      const session = makeSession(trimmedPrompt, mode, profile, cards, data.title || titleFromPrompt(trimmedPrompt));

      session.summary = data.summary || session.summary;
      setSessions((current) => [session, ...current].slice(0, 12));
      setActiveSession(session);
      setProjects((current) => persistSessionToProject(current, activeProjectId, session));
      if (selectedPreset) setSelectedPreset('');
    } catch (err) {
      const fallbackCards = buildLocalCards(trimmedPrompt, mode);
      const fallbackSession = makeSession(trimmedPrompt, mode, profile, fallbackCards);

      setSessions((current) => [fallbackSession, ...current].slice(0, 12));
      setActiveSession(fallbackSession);
      setProjects((current) => persistSessionToProject(current, activeProjectId, fallbackSession));
      setError(
        err instanceof Error ? err.message : 'AI generation failed. A local fallback was used instead.'
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function exportMarkdown() {
    if (!activeSession) return;

    const markdown = `# ${activeSession.title}\n\n- Mode: ${MODE_META[activeSession.mode].label}\n- Profile: ${PROFILE_META[activeSession.profile]}\n- Created: ${new Date(activeSession.createdAt).toLocaleString()}\n\n${activeSession.cards
      .map((card) => `## ${card.title}\n${card.content}\n`)
      .join('\n')}`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${activeSession.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'thinking-session'}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">M</div>
          <div>
            <p className="eyebrow">AI workspace</p>
            <h1>MindForge</h1>
          </div>
        </div>

        <div className="panel project-panel">
          <label htmlFor="project-name">Project</label>
          <input
            id="project-name"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Strategy Workspace"
          />

          <label htmlFor="project-description">Project brief</label>
          <textarea
            id="project-description"
            rows={3}
            value={projectDescription}
            onChange={(event) => setProjectDescription(event.target.value)}
            placeholder="Describe the initiative, goal, or team context."
          />

          <div className="inline-actions">
            <button className="secondary small" onClick={createProject}>New project</button>
            <button className="secondary small" onClick={saveCurrentSessionToProject} disabled={!activeSession}>Save session</button>
          </div>
        </div>

        <div className="metrics-panel">
          <h2>Project snapshot</h2>
          <div className="metric-grid">
            <div className="metric-box">
              <strong>{projectMetrics.totalSessions}</strong>
              <span>Sessions</span>
            </div>
            <div className="metric-box">
              <strong>{projectMetrics.totalCards}</strong>
              <span>Cards</span>
            </div>
            <div className="metric-box">
              <strong>{projectMetrics.uniqueModes}</strong>
              <span>Modes</span>
            </div>
            <div className="metric-box">
              <strong>{projectMetrics.lastUpdated}</strong>
              <span>Updated</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <label htmlFor="topic">Thinking prompt</label>
          <textarea
            id="topic"
            rows={6}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the challenge, decision, opportunity, or concept..."
          />

          <div className="field-row">
            <div className="field-block">
              <label htmlFor="mode">Mode</label>
              <select id="mode" value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
                {Object.entries(MODE_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>

            <div className="field-block">
              <label htmlFor="profile">Profile</label>
              <select id="profile" value={profile} onChange={(event) => setProfile(event.target.value as Profile)}>
                {Object.entries(PROFILE_META).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <label htmlFor="preset">Prompt template</label>
          <select
            id="preset"
            value={selectedPreset}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedPreset(value);
              const selected = presetPrompts.find((item) => item.label === value);
              if (selected) setPrompt(selected.value);
            }}
          >
            <option value="">Custom prompt</option>
            {presetPrompts.map((preset) => (
              <option key={preset.label} value={preset.label}>{preset.label}</option>
            ))}
          </select>

          <button className="primary" onClick={generateSession} disabled={isGenerating}>
            {isGenerating ? 'Thinking...' : 'Generate insight map'}
          </button>

          {error ? <div className="error-box">{error}</div> : null}
        </div>

        <div className="recent-panel">
          <h2>Projects</h2>
          {projects.length === 0 ? (
            <p className="empty-state">No projects yet.</p>
          ) : (
            <ul>
              {projects.map((project) => (
                <li key={project.id} onClick={() => setActiveProjectId(project.id)}>
                  <strong>{project.name}</strong>
                  <span>{project.sessions.length} saved sessions</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Working session</p>
            <h2>{activeSession ? activeSession.title : 'New thought board'}</h2>
          </div>

          <button className="secondary" onClick={exportMarkdown} disabled={!activeSession}>
            Export note
          </button>
        </header>

        {activeSession ? (
          <>
            <section className="summary-card" style={{ borderTop: `3px solid ${MODE_META[activeSession.mode].accent}` }}>
              <div className="summary-header">
                <div>
                  <p className="eyebrow">Session summary</p>
                  <h3>{activeSummary}</h3>
                </div>
                <span className="chip">{PROFILE_META[activeSession.profile]}</span>
              </div>
              <p>{activeSession.summary}</p>
              <div className="meta-row">
                <span>{activeSession.prompt}</span>
                <span>{new Date(activeSession.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="tag-row">
                {activeSession.tags.map((tag) => (
                  <span key={`${activeSession.id}-${tag}`} className="tag-chip">#{tag}</span>
                ))}
              </div>
            </section>

            <section className="card-grid">
              {activeSession.cards.map((card) => (
                <article key={`${activeSession.id}-${card.title}`} className="insight-card">
                  <span className="label-pill">{card.label}</span>
                  <h4>{card.title}</h4>
                  <p>{card.content}</p>
                </article>
              ))}
            </section>
          </>
        ) : (
          <section className="empty-panel">
            <div>
              <h3>Start with a challenge</h3>
              <p>
                Use this workspace to think through decisions, generate opportunities, build roadmaps, or analyze complex ideas.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
