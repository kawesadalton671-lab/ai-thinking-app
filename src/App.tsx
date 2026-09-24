import { useEffect, useMemo, useState } from 'react';

type Mode = 'brainstorm' | 'decision' | 'plan' | 'analysis';

type ThoughtCard = {
  label: string;
  title: string;
  content: string;
};

type Session = {
  id: number;
  title: string;
  mode: Mode;
  summary: string;
  cards: ThoughtCard[];
  createdAt: string;
};

const modeLabels: Record<Mode, string> = {
  brainstorm: 'Brainstorm',
  decision: 'Decision',
  plan: 'Plan',
  analysis: 'Analysis'
};

const storageKey = 'mindforge-sessions';

function buildCards(topic: string, mode: Mode): ThoughtCard[] {
  const cleanTopic = topic.trim() || 'a new opportunity';
  const words = cleanTopic.split(/\s+/).filter(Boolean);
  const primary = words.slice(0, 3).join(' ') || 'the challenge';

  if (mode === 'brainstorm') {
    return [
      {
        label: 'Core direction',
        title: 'Big idea',
        content: `Position ${cleanTopic} as a high-value opportunity by focusing on user impact, speed to value, and a clear differentiation from current alternatives.`
      },
      {
        label: 'Creative angles',
        title: 'Novel ideas',
        content: `Explore edge cases around ${primary}, define a few bold experiments, and test ideas that feel surprising but align with the user need.`
      },
      {
        label: 'Watch-outs',
        title: 'Hidden friction',
        content: `Look for bottlenecks in adoption, unclear incentives, and complexity that could slow trust or make the experience feel heavy.`
      },
      {
        label: 'Next move',
        title: 'Actionable next step',
        content: `Create a fast prototype and collect feedback from a small group of target users before investing heavily in a final direction.`
      }
    ];
  }

  if (mode === 'decision') {
    return [
      {
        label: 'Decision criteria',
        title: 'What matters most',
        content: `Weigh speed, cost, strategic alignment, customer experience, and long-term flexibility before choosing a path for ${cleanTopic}.`
      },
      {
        label: 'Best-case',
        title: 'Strong upside',
        content: `The strongest option is the one that maximizes velocity while preserving room to adapt if user feedback shifts priorities.`
      },
      {
        label: 'Risk check',
        title: 'Where it could fail',
        content: `The biggest risk is over-optimizing for a short-term win while ignoring operational complexity or team readiness.`
      },
      {
        label: 'Recommendation',
        title: 'Suggested call',
        content: `Choose the option with the best signal-to-effort ratio and validate it with a low-risk pilot before scaling.`
      }
    ];
  }

  if (mode === 'plan') {
    return [
      {
        label: 'Goal',
        title: 'Outcome',
        content: `Define the target outcome for ${cleanTopic} with measurable success indicators, practical constraints, and a firm timeline.`
      },
      {
        label: 'Execution',
        title: 'Key milestones',
        content: `Break the project into small milestones: discovery, prototype, validation, and roll-out, with decision gates after each stage.`
      },
      {
        label: 'Dependencies',
        title: 'Required support',
        content: `Map any research, technical dependencies, launch approvals, or stakeholder alignment needed before moving to the next step.`
      },
      {
        label: 'Momentum',
        title: 'Weekly rhythm',
        content: `Review progress weekly, surface risks early, and keep the plan adaptive to avoid stalling on low-impact decisions.`
      }
    ];
  }

  return [
    {
      label: 'Signal',
      title: 'What is happening',
      content: `The relevant pattern in ${cleanTopic} suggests a mix of opportunity, user need, and operational constraints that should be examined together.`
    },
    {
      label: 'Evidence',
      title: 'Why it matters',
      content: `Identify the strongest evidence, assumptions, and examples that either support or challenge the current direction of the concept.`
    },
    {
      label: 'Interpretation',
      title: 'Meaning',
      content: `The strongest interpretation is that the idea has traction only if it solves a real problem with clarity and measurable value.`
    },
    {
      label: 'Conclusion',
      title: 'Actionable read',
      content: `If the observed signal remains consistent under validation, pursue it with focused experiments and keep the most uncertain assumptions visible.`
    }
  ];
}

const getInitialSessions = (): Session[] => {
  if (typeof window === 'undefined') return [];

  const saved = localStorage.getItem(storageKey);
  if (!saved) return [];

  try {
    return JSON.parse(saved) as Session[];
  } catch {
    return [];
  }
};

export default function App() {
  const [topic, setTopic] = useState('Build a values-driven AI assistant for product teams');
  const [mode, setMode] = useState<Mode>('brainstorm');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  useEffect(() => {
    setSessions(getInitialSessions());
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    }
  }, [sessions]);

  const generatedSummary = useMemo(() => {
    if (!activeSession) return null;
    return `${activeSession.title} • ${modeLabels[activeSession.mode]}`;
  }, [activeSession]);

  const createSession = () => {
    const trimmed = topic.trim();
    const title = trimmed.length > 0 ? trimmed.slice(0, 42) : 'Untitled thought';
    const cards = buildCards(trimmed || 'a new opportunity', mode);
    const session: Session = {
      id: Date.now(),
      title,
      mode,
      summary: `A ${modeLabels[mode].toLowerCase()} session focused on ${trimmed || 'a new opportunity'}.`,
      cards,
      createdAt: new Date().toISOString()
    };

    setSessions((current) => [session, ...current].slice(0, 8));
    setActiveSession(session);
  };

  const exportMarkdown = () => {
    if (!activeSession) return;

    const markdown = `# ${activeSession.title}\n\n- Mode: ${modeLabels[activeSession.mode]}\n- Created: ${new Date(activeSession.createdAt).toLocaleString()}\n\n${activeSession.cards
      .map((card) => `## ${card.title}\n${card.content}\n`)
      .join('\n')}`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${activeSession.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'thought'}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

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
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Describe the challenge, decision, or concept you want to explore..."
          />

          <label htmlFor="mode">Thinking mode</label>
          <select id="mode" value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
            <option value="brainstorm">Brainstorm</option>
            <option value="decision">Decision</option>
            <option value="plan">Plan</option>
            <option value="analysis">Analysis</option>
          </select>

          <button className="primary" onClick={createSession}>
            Generate thinking map
          </button>
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
                  <span>{modeLabels[session.mode]}</span>
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
            <section className="summary-card">
              <div>
                <p className="eyebrow">Session summary</p>
                <h3>{generatedSummary}</h3>
              </div>
              <p>{activeSession.summary}</p>
            </section>

            <section className="card-grid">
              {activeSession.cards.map((card) => (
                <article key={card.label} className="insight-card">
                  <span className="label-pill">{card.label}</span>
                  <h4>{card.title}</h4>
                  <p>{card.content}</p>
                </article>
              ))}
            </section>
          </>
        ) : (
          <section className="empty-panel">
            <h3>Start with a challenge</h3>
            <p>
              Use this workspace to run a brainstorm, compare options, build a plan, or analyze a complex idea.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
