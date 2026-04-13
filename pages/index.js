import Head from 'next/head';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

function todayFull() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function todayShort() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function Tag({ label, color, bg }) {
  return (
    <span className="tag" style={{
      color: color || 'var(--gold)',
      background: bg || 'rgba(166,124,58,0.1)',
      border: `1px solid ${color || 'var(--gold)'}30`,
    }}>{label}</span>
  );
}

function Empty({ msg }) {
  return (
    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1rem', color: 'var(--ghost)', fontStyle: 'italic', padding: '8px 0' }}>
      {msg}
    </div>
  );
}

// ── Section card with dramatic editorial header ────────────────────────────────
function Section({ icon, eyebrow, title, accentColor, delay, children, fullWidth }) {
  const accent = accentColor || 'var(--gold)';
  return (
    <div className={`fade-up ${delay || ''} card-hover`} style={{
      background: 'var(--bg2)',
      border: `1px solid var(--border)`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 2,
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      {/* Section header */}
      <div style={{
        padding: '16px 24px 14px',
        background: `linear-gradient(135deg, ${accent}08 0%, transparent 60%)`,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
        <div>
          {eyebrow && (
            <div style={{ fontSize: '0.52rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: accent, marginBottom: 2, fontWeight: 500 }}>
              {eyebrow}
            </div>
          )}
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '1.35rem', letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1,
          }}>
            {title}
          </div>
        </div>
      </div>
      {/* Content */}
      <div style={{ padding: '18px 24px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Section components ─────────────────────────────────────────────────────────

function ActionItem({ item, isLast }) {
  const pc = { high: '#a82820', medium: '#a67c3a', low: '#1e6b4a' };
  const pb = { high: 'rgba(168,40,32,0.08)', medium: 'rgba(166,124,58,0.08)', low: 'rgba(30,107,74,0.08)' };
  const color = pc[item.priority] || 'var(--faint)';
  const bgColor = pb[item.priority] || 'transparent';
  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'flex-start',
      padding: '12px 14px', borderRadius: 3,
      background: bgColor,
      borderLeft: `3px solid ${color}`,
      marginBottom: isLast ? 0 : 8,
    }}>
      <Tag label={item.priority} color={color} bg={bgColor} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: '1.05rem', color: 'var(--text)', lineHeight: 1.4, marginBottom: 3 }}>{item.action}</div>
        {item.context && <div style={{ fontSize: '0.65rem', color: 'var(--faint)', lineHeight: 1.6 }}>{item.context}</div>}
      </div>
    </div>
  );
}

function ActionSection({ items }) {
  if (!items?.length) return <Empty msg="No action items generated." />;
  return <div>{items.map((item, i) => <ActionItem key={i} item={item} isLast={i === items.length - 1} />)}</div>;
}

function RevisionSection({ items }) {
  if (!items?.length) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(30,107,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>✓</div>
      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1rem', color: 'var(--green)', fontStyle: 'italic' }}>No outstanding revisions in inbox.</div>
    </div>
  );
  function ageColor(d) { const n = parseInt(d)||0; return n>=5?'#a82820':n>=2?'#a67c3a':'var(--faint)'; }
  return (
    <div>
      <div style={{ fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ghost)', marginBottom: 14 }}>
        {items.length} outstanding · inbox only · corrections excluded · oldest first
      </div>
      {items.map((r, i) => (
        <div key={i} className="row-h" style={{
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
          padding: '10px 12px', marginBottom: 4,
          borderLeft: `3px solid ${ageColor(r.daysAgo)}`,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>{r.from}</span>
              <Tag label={`${r.daysAgo??'?'}d`} color={ageColor(r.daysAgo)} bg={`${ageColor(r.daysAgo)}12`} />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--dim)', marginBottom: 3, lineHeight: 1.4 }}>{r.subject}</div>
            <div style={{ fontSize: '0.63rem', color: 'var(--faint)', lineHeight: 1.6 }}>{r.description || r.snippet}</div>
          </div>
          <div style={{ fontSize: '0.58rem', color: 'var(--ghost)', whiteSpace: 'nowrap', paddingTop: 2 }}>
            {r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmailSection({ emails }) {
  if (!emails?.length) return <Empty msg="No unread AMC/client emails in the last 48 hours." />;
  return (
    <div>
      {emails.map((e, i) => (
        <div key={i} className="row-h" style={{
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
          padding: '10px 12px', marginBottom: 4,
          borderBottom: i < emails.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>{e.from}</span>
              {e.needsAction && <Tag label="Action needed" />}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--dim)', marginBottom: 3 }}>{e.subject}</div>
            <div style={{ fontSize: '0.63rem', color: 'var(--faint)', lineHeight: 1.6 }}>{e.summary || e.snippet}</div>
          </div>
          <div style={{ fontSize: '0.58rem', color: 'var(--ghost)', whiteSpace: 'nowrap' }}>
            {e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarSection({ events }) {
  if (!events?.length) return <Empty msg="No events found for today or tomorrow." />;
  let lastDate = null;
  return (
    <div>
      {events.map((e, i) => {
        let dateLabel = null;
        let timeStr = 'All Day';
        try {
          const d = e.start ? new Date(e.start) : null;
          if (d) {
            const dayStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            if (dayStr !== lastDate) { dateLabel = dayStr; lastDate = dayStr; }
            timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          }
        } catch {}
        return (
          <div key={i}>
            {dateLabel && (
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 500, marginTop: i > 0 ? 16 : 0, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                {dateLabel}
              </div>
            )}
            <div className="row-h" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '8px 10px', marginBottom: 4 }}>
              <div style={{ minWidth: 76, fontSize: '0.65rem', color: 'var(--teal)', fontWeight: 500, paddingTop: 2 }}>{timeStr}</div>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: '1rem', color: 'var(--text)' }}>{e.title}</div>
                {e.location && <div style={{ fontSize: '0.63rem', color: 'var(--faint)', marginTop: 2 }}>📍 {e.location}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FactGrid({ facts }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
      {facts.map(f => (
        <div key={f.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 2, padding: '8px 10px' }}>
          <div style={{ fontSize: '0.52rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ghost)', marginBottom: 3 }}>{f.label}</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, color: f.val === 'N/A' ? 'var(--ghost)' : 'var(--text)', fontFamily: f.val !== 'N/A' ? "'Cormorant Garamond', Georgia, serif" : undefined, fontSize: f.val !== 'N/A' ? '0.9rem' : '0.68rem' }}>
            {f.val || 'N/A'}
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertyCard({ p, index }) {
  const statusColor = p.listingStatus === 'Active' ? '#1e6b4a' : p.listingStatus === 'Pending' ? '#a67c3a' : p.listingStatus === 'Off-Market' ? '#a82820' : 'var(--ghost)';
  const facts = [
    { label: 'Type',            val: p.propertyType },
    { label: 'Beds / Baths',    val: (p.beds !== 'N/A' && p.baths !== 'N/A') ? `${p.beds} bd · ${p.baths} ba` : 'N/A' },
    { label: 'Above-Grade GLA', val: p.gla !== 'N/A' ? `${p.gla} sf` : 'N/A' },
    { label: 'Year Built',      val: p.yearBuilt },
    { label: 'Lot Size',        val: p.lotSize },
    { label: 'Est. Value',      val: p.estimatedValue },
    { label: 'Last Sale',       val: p.lastSaleDate !== 'N/A' ? `${p.lastSaleDate}` : 'N/A' },
    { label: 'Last Sale Price', val: p.lastSalePrice },
    { label: 'Est. Taxes/yr',   val: p.estimatedTaxes },
  ];
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 2, overflow: 'hidden', marginBottom: 16,
    }}>
      {/* Property header */}
      <div style={{ background: 'var(--navy)', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: '0.52rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(200,184,160,0.5)', marginBottom: 4 }}>
            Inspection #{index + 1}
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: '1.2rem', color: '#fff', lineHeight: 1.2 }}>
            {p.address}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {p.inspectionTime && (
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', color: 'var(--goldlt)', letterSpacing: '0.06em', lineHeight: 1 }}>
              {p.inspectionTime}
            </div>
          )}
        </div>
      </div>
      {/* Tags row */}
      <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--bg3)' }}>
        {p.county && <Tag label={p.county} color="var(--teal)" bg="rgba(30,107,122,0.08)" />}
        {p.subdivision && p.subdivision !== 'N/A' && <Tag label={p.subdivision} color="var(--dim)" bg="rgba(74,64,56,0.08)" />}
        {p.listingStatus && p.listingStatus !== 'N/A' && <Tag label={p.listingStatus} color={statusColor} bg={`${statusColor}12`} />}
        {p.listPrice && p.listPrice !== 'N/A' && <Tag label={`List: ${p.listPrice}`} color="var(--gold)" />}
        {p.dom && p.dom !== 'N/A' && <Tag label={`${p.dom} DOM`} color="var(--faint)" bg="transparent" />}
      </div>
      {/* Facts + content */}
      <div style={{ padding: '14px 18px' }}>
        <FactGrid facts={facts} />
        {p.marketContext && (
          <div style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.95rem', lineHeight: 1.8,
            color: 'var(--dim)', marginBottom: 14, paddingLeft: 14,
            borderLeft: '2px solid var(--border2)', fontStyle: 'italic',
          }}>
            {p.marketContext}
          </div>
        )}
        {p.flags?.length > 0 && (
          <div style={{ background: 'rgba(168,40,32,0.05)', border: '1px solid rgba(168,40,32,0.15)', borderRadius: 2, padding: '10px 14px', marginBottom: 10 }}>
            <div style={{ fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a82820', fontWeight: 500, marginBottom: 6 }}>⚠ Appraiser Flags</div>
            {p.flags.map((f, fi) => (
              <div key={fi} style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.9rem', color: '#a82820', lineHeight: 1.7 }}>· {f}</div>
            ))}
          </div>
        )}
        {p.pullManually?.length > 0 && (
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 2, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ghost)', fontWeight: 500, marginBottom: 5 }}>Pull Manually — qPublic / FMLS / Schneidercorp</div>
            {p.pullManually.map((item, pi) => (
              <div key={pi} style={{ fontSize: '0.65rem', color: 'var(--faint)', lineHeight: 1.7 }}>· {item}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PropertySection({ properties, emptyMsg }) {
  if (!properties?.length) return <Empty msg={emptyMsg} />;
  return <div>{properties.map((p, i) => <PropertyCard key={i} p={p} index={i} />)}</div>;
}

function NewsItem({ n, isLast }) {
  return (
    <div style={{ paddingBottom: isLast ? 0 : 18, marginBottom: isLast ? 0 : 18, borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 500 }}>{n.source}</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--ghost)' }}>·</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--ghost)' }}>{n.date}</span>
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)', lineHeight: 1.35, marginBottom: 6 }}>{n.headline}</div>
      <div style={{ fontSize: '0.68rem', color: 'var(--dim)', lineHeight: 1.8, marginBottom: 8 }}>{n.summary}</div>
      {n.url && n.url !== 'N/A' && (
        <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.6rem', color: 'var(--teal)', textDecoration: 'none', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Read full article →
        </a>
      )}
    </div>
  );
}

function NewsSection({ items }) {
  if (!items?.length) return <Empty msg="No news items retrieved." />;
  return <div>{items.map((n, i) => <NewsItem key={i} n={n} isLast={i === items.length - 1} />)}</div>;
}

// ── Loading indicator ──────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Reading Gmail inbox', icon: '✉' },
  { label: 'Checking revisions', icon: '✏️' },
  { label: 'Pulling calendar', icon: '📅' },
  { label: 'Researching properties', icon: '🏠' },
  { label: 'Scanning industry news', icon: '📰' },
  { label: 'Building action items', icon: '⚡' },
];

function LoadingView({ step }) {
  const idx = STEPS.findIndex(s => s.label === step);
  return (
    <div style={{ maxWidth: 500, margin: '60px auto', padding: '0 24px' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', letterSpacing: '0.06em', color: 'var(--text)', marginBottom: 6 }}>
        Compiling Your Briefing
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.95rem', color: 'var(--faint)', fontStyle: 'italic', marginBottom: 36 }}>
        Pulling live data from your accounts...
      </div>
      {STEPS.map((s, i) => {
        const done = i < idx, active = i === idx;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, opacity: done ? 0.5 : active ? 1 : 0.3, transition: 'opacity 0.3s' }}>
            <div className={active ? 'pulsing' : ''} style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: done ? 'var(--green)' : active ? 'var(--gold)' : 'var(--bg4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: done ? '0.7rem' : '0.9rem', transition: 'background 0.3s',
              boxShadow: active ? '0 0 16px rgba(166,124,58,0.3)' : 'none',
            }}>
              {done ? '✓' : s.icon}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1rem', color: active ? 'var(--text)' : 'var(--faint)', fontWeight: active ? 600 : 400 }}>
              {s.label}
            </div>
            {active && <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [state, setState] = useState('idle');
  const [step,  setStep]  = useState('');
  const [data,  setData]  = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  async function runBriefing() {
    setState('loading');
    setData(null);
    setError('');
    setStep(STEPS[0].label);

    let i = 0;
    const interval = setInterval(() => {
      i = Math.min(i + 1, STEPS.length - 1);
      setStep(STEPS[i].label);
    }, 2200);

    try {
      const res  = await fetch('/api/briefing');
      const json = await res.json();
      clearInterval(interval);
      if (!res.ok) throw new Error(json.error || 'Briefing failed');
      setData(json);
      setState('done');
    } catch (e) {
      clearInterval(interval);
      setError(e.message);
      setState('error');
    }
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--ghost)', letterSpacing: '0.1em' }}>Loading...</div>
    </div>;
  }

  return (
    <>
      <Head>
        <title>Morning Briefing — Simmons Appraisals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: '100vh', background: 'var(--bg)', backgroundImage: 'radial-gradient(ellipse at 100% 0%, rgba(166,124,58,0.04) 0%, transparent 50%)' }}>

        {/* ── Masthead ── */}
        <div style={{
          background: 'var(--navy)',
          backgroundImage: 'linear-gradient(135deg, #1a2744 0%, #0f1828 100%)',
          padding: '0 40px',
          display: 'flex', alignItems: 'stretch',
        }}>
          {/* Left: branding */}
          <div style={{ padding: '18px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.5rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(200,184,160,0.4)', marginBottom: 4 }}>
              Simmons Appraisals LLC · Gainesville, GA
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.2rem', letterSpacing: '0.06em', lineHeight: 1,
                background: 'linear-gradient(135deg, #c8983a 0%, #e8c87a 50%, #a67c3a 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>Morning Briefing</div>
              <div style={{ width: 1, height: 20, background: 'rgba(200,184,160,0.2)' }} />
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'rgba(200,184,160,0.5)', paddingBottom: 2 }}>{todayFull()}</div>
            </div>
          </div>
          {/* Right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 24, borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            {state === 'done' && (
              <button className="run-btn" onClick={runBriefing} style={{
                fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em',
                textTransform: 'uppercase', padding: '8px 18px',
                background: 'rgba(200,152,58,0.15)', color: 'var(--goldlt)',
                border: '1px solid rgba(200,152,58,0.3)', borderRadius: 2,
              }}>↺ Refresh</button>
            )}
            <button onClick={() => signOut({ callbackUrl: '/login' })} style={{
              fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', padding: '8px 16px',
              background: 'none', color: 'rgba(200,184,160,0.4)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, cursor: 'pointer',
            }}>Sign Out</button>
          </div>
        </div>

        {/* ── Thin gold rule under header ── */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, var(--gold), var(--goldlt) 40%, var(--gold) 70%, transparent)' }} />

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 28px 64px' }}>

          {/* IDLE */}
          {state === 'idle' && (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '4rem', letterSpacing: '0.04em', color: 'var(--text)', lineHeight: 0.95, marginBottom: 4 }}>Ready When</div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '4rem', letterSpacing: '0.04em', lineHeight: 0.95, marginBottom: 28,
                background: 'linear-gradient(135deg, #a67c3a 0%, #c8983a 50%, #a67c3a 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>You Are</div>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', color: 'var(--faint)', fontStyle: 'italic', maxWidth: 400, margin: '0 auto 44px' }}>
                Gmail · Calendar · Property Research · Industry News
              </div>
              <button className="run-btn" onClick={runBriefing} style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '1.1rem', letterSpacing: '0.1em',
                padding: '18px 56px', background: 'var(--navy)', color: '#fff',
                border: 'none', borderRadius: 2, cursor: 'pointer',
                boxShadow: '0 6px 28px rgba(26,39,68,0.2)',
              }}>☀ Run Morning Briefing</button>
            </div>
          )}

          {/* LOADING */}
          {state === 'loading' && <LoadingView step={step} />}

          {/* ERROR */}
          {state === 'error' && (
            <div style={{ padding: '20px 24px', background: 'rgba(168,40,32,0.06)', border: '1px solid rgba(168,40,32,0.2)', borderRadius: 2, marginBottom: 16 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1rem', color: '#a82820', marginBottom: 12 }}>Briefing failed: {error}</div>
              <button className="run-btn" onClick={runBriefing} style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 20px', background: 'var(--bg3)', color: 'var(--dim)', border: '1px solid var(--border)', borderRadius: 2 }}>Retry</button>
            </div>
          )}

          {/* DONE */}
          {state === 'done' && data && (
            <div>
              {/* Date strip */}
              <div className="deco-rule">
                <span style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ghost)', whiteSpace: 'nowrap' }}>{todayFull()}</span>
              </div>

              <Section icon="⚡" eyebrow="Priority" title="Action Items" accentColor="var(--gold)" delay="s1">
                <ActionSection items={data.actions} />
              </Section>

              <Section icon="✏️" eyebrow="Inbox Only" title="Outstanding Revisions" accentColor="var(--red)" delay="s2">
                <RevisionSection items={data.revisions} />
              </Section>

              <Section icon="✉" eyebrow="Last 48 Hours · Unread" title="AMC & Client Emails" accentColor="var(--teal)" delay="s3">
                <EmailSection emails={data.emails} />
              </Section>

              <Section icon="📅" eyebrow="Today & Tomorrow" title="Schedule" accentColor="var(--navy)" delay="s4">
                <CalendarSection events={data.calendar} />
              </Section>

              <Section icon="🏠" eyebrow="Pre-Inspection Briefing" title="Today's Inspection Research" accentColor="var(--gold)" delay="s5">
                <PropertySection properties={data.todayProperties} emptyMsg="No appraisal addresses found on today's calendar." />
              </Section>

              <Section icon="🔭" eyebrow="Pre-Inspection Briefing" title="Tomorrow's Inspection Research" accentColor="var(--teal)" delay="s6">
                <PropertySection properties={data.tomorrowProperties} emptyMsg="No appraisal addresses found on tomorrow's calendar." />
              </Section>

              <Section icon="📰" eyebrow="Appraisal & Mortgage · Last 7 Days" title="Industry News" accentColor="var(--navy)" delay="s7">
                <NewsSection items={data.news} />
              </Section>

              <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ghost)' }}>
                  Simmons Appraisals LLC · Gainesville, GA · License #338575
                </div>
                <div style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: 'var(--ghost)' }}>{todayShort()}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
