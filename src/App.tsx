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

function titleFromPrompt(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) return 'Untitled thought';
  return trimmed.slice(0, 48).trim();
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
      content: `The strongest signal behind ${cleanPrompt} is a combination of user friction, strategic relevance, and the potential to create measurable value if it is addressed well.`
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
}

function buildSummary(prompt: string, mode: Mode, profile: Profile) {
  const normalized = prompt.trim() || 'a new opportunity';
  return `A ${PROFILE_META[profile]} ${MODE_META[mode].label.toLowerCase()} session focused on ${normalized}.`;
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
    createdAt: new Date().toISOString()
  };
}

export default function App() {
  const [prompt, setPrompt] = useState('Build a values-driven AI assistant for product teams');
  const [mode, setMode] = useState<Mode>('brainstorm');
  const [profile, setProfile] = useState<Profile>('balanced');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSessions(getInitialSessions());
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  const activeSummary = useMemo(() => {
    if (!activeSession) return null;
    return `${activeSession.title} • ${MODE_META[activeSession.mode].label}`;
  }, [activeSession]);

  const composeSession = (cards: ThoughtCard[], titleOverride?: string) => {
    const trimmedPrompt = prompt.trim();
    const session = makeSession(trimmedPrompt || 'A new opportunity', mode, profile, cards, titleOverride);
    setSessions((current) => [session, ...current].slice(0, 12));
    setActiveSession(session);
  };

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
      const title = data.title || titleFromPrompt(trimmedPrompt);
      const summary = data.summary || buildSummary(trimmedPrompt, mode, profile);
      const session = {
        id: Date.now() + Math.random(),
        title,
        mode,
        profile,
        prompt: trimmedPrompt,
        summary,
        cards,
        createdAt: new Date().toISOString()
      };

      setSessions((current) => [session, ...current].slice(0, 12));
      setActiveSession(session);
    } catch (err) {
      const fallbackCards = buildLocalCards(trimmedPrompt, mode);
      const fallbackSession = makeSession(trimmedPrompt, mode, profile, fallbackCards);
      setSessions((current) => [fallbackSession, ...current].slice(0, 12));
      setActiveSession(fallbackSession);
      setError(err instanceof Error ? err.message : 'AI generation failed. A local fallback was used instead.');
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

          <button className="primary" onClick={generateSession} disabled={isGenerating}>
            {isGenerating ? 'Thinking...' : 'Generate insight map'}
          </button>

          {error ? <div className="error-box">{error}</div> : null}
        </div>

        <div className="recent-panel">
          <h2>Recent sessions</h2>
          {sessions.length === 0 ? (
            <p className="empty-state">No sessions yet.</p>
          ) : (
            <ul>
              {sessions.map((session) => (
                <li key={session.id} onClick={() => setActiveSession(session)}>
                  <strong>{session.title}</strong>
                  <span>{MODE_META[session.mode].label}</span>
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
                <span>Prompt: {activeSession.prompt}</span>
                <span>{new Date(activeSession.createdAt).toLocaleDateString()}</span>
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
