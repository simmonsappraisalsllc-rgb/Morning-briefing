import Head from 'next/head';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

function today() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Design tokens (light mode matching toolkit) ────────────────────────────────
const C = {
  bg:      '#f5f4f0',
  bg2:     '#ffffff',
  bg3:     '#ede9e1',
  border:  '#d4cfc4',
  accent:  '#9a6f2e',
  accent2: '#2e7a9a',
  green:   '#2e7a5a',
  red:     '#c0392b',
  text:    '#1e1c18',
  dim:     '#5a5648',
  faint:   '#9a9488',
};

// ── Shared components ──────────────────────────────────────────────────────────

function Tag({ label, color }) {
  return (
    <span className="tag" style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>{label}</span>
  );
}

function Empty({ msg }) {
  return <div style={{ fontSize: '0.72rem', color: C.faint, fontStyle: 'italic' }}>{msg}</div>;
}

function SectionCard({ icon, title, sub, accentColor, delay, children }) {
  const leftColor = accentColor || C.border;
  return (
    <div className={`fade-up ${delay || ''}`} style={{
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${leftColor}`,
      borderRadius: 4,
      padding: '18px 22px',
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700, fontSize: '0.95rem',
            color: accentColor || C.accent,
            letterSpacing: '0.03em', textTransform: 'uppercase',
          }}>{title}</div>
          {sub && <div style={{ fontSize: '0.6rem', color: C.faint, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Section content components ─────────────────────────────────────────────────

function ActionSection({ items }) {
  if (!items?.length) return <Empty msg="No action items generated." />;
  const pc = { high: C.red, medium: C.accent, low: C.green };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 10, borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
          <Tag label={item.priority} color={pc[item.priority] || C.faint} />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: C.text, lineHeight: 1.5 }}>{item.action}</div>
            {item.context && <div style={{ fontSize: '0.65rem', color: C.dim, marginTop: 3, lineHeight: 1.6 }}>{item.context}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function RevisionSection({ items }) {
  if (!items?.length) return <div style={{ fontSize: '0.72rem', color: C.green, fontWeight: 500 }}>✓ No outstanding revisions in inbox.</div>;
  function ageColor(d) {
    const n = parseInt(d) || 0;
    return n >= 5 ? C.red : n >= 2 ? C.accent : C.faint;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: '0.6rem', color: C.faint, marginBottom: 10, letterSpacing: '0.08em' }}>
        {items.length} outstanding revision{items.length !== 1 ? 's' : ''} — oldest first · inbox only
      </div>
      {items.map((r, i) => (
        <div key={i} className="row-hover" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, borderLeft: `3px solid ${ageColor(r.daysAgo)}`, paddingLeft: 12, marginBottom: 4 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 500, fontSize: '0.72rem', color: C.text }}>{r.from}</span>
              <Tag label={`${r.daysAgo ?? '?'}d ago`} color={ageColor(r.daysAgo)} />
            </div>
            <div style={{ fontSize: '0.7rem', color: C.dim, marginBottom: 2 }}>{r.subject}</div>
            <div style={{ fontSize: '0.65rem', color: C.faint, lineHeight: 1.6 }}>{r.description || r.snippet}</div>
          </div>
          <div style={{ fontSize: '0.58rem', color: C.faint, whiteSpace: 'nowrap', paddingTop: 2 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {emails.map((e, i) => (
        <div key={i} className="row-hover" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, borderBottom: i < emails.length - 1 ? `1px solid ${C.border}` : 'none', paddingBottom: 8, marginBottom: 4 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 500, fontSize: '0.72rem', color: C.text }}>{e.from}</span>
              {e.needsAction && <Tag label="Action" color={C.accent} />}
            </div>
            <div style={{ fontSize: '0.7rem', color: C.dim, marginBottom: 2 }}>{e.subject}</div>
            <div style={{ fontSize: '0.65rem', color: C.faint, lineHeight: 1.6 }}>{e.summary || e.snippet}</div>
          </div>
          <div style={{ fontSize: '0.58rem', color: C.faint, whiteSpace: 'nowrap' }}>
            {e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarSection({ events }) {
  if (!events?.length) return <Empty msg="No events found for today or tomorrow." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.map((e, i) => {
        let timeStr = 'All Day';
        try { timeStr = e.start ? new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All Day'; } catch {}
        return (
          <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: 10, borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ minWidth: 72, fontSize: '0.65rem', color: C.accent2, fontWeight: 500, paddingTop: 2 }}>{timeStr}</div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 500, color: C.text }}>{e.title}</div>
              {e.location && <div style={{ fontSize: '0.65rem', color: C.faint, marginTop: 2 }}>📍 {e.location}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PropertyCard({ p }) {
  const statusColor = p.listingStatus === 'Active' ? C.green : p.listingStatus === 'Pending' ? C.accent : p.listingStatus === 'Off-Market' ? C.red : C.faint;
  const facts = [
    { label: 'Type',           val: p.propertyType },
    { label: 'Beds / Baths',   val: (p.beds !== 'N/A' || p.baths !== 'N/A') ? `${p.beds} bd / ${p.baths} ba` : 'N/A' },
    { label: 'GLA',            val: p.gla !== 'N/A' ? `${p.gla} sf` : 'N/A' },
    { label: 'Year Built',     val: p.yearBuilt },
    { label: 'Lot Size',       val: p.lotSize },
    { label: 'Est. Value',     val: p.estimatedValue },
    { label: 'Last Sale Date', val: p.lastSaleDate },
    { label: 'Last Sale $',    val: p.lastSalePrice },
    { label: 'Est. Taxes/yr',  val: p.estimatedTaxes },
  ];
  return (
    <div style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px', marginBottom: 14 }}>
      {/* Address + time header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 10 }}>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '0.95rem', color: C.text }}>{p.address}</div>
        {p.inspectionTime && <Tag label={p.inspectionTime} color={C.accent2} />}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {p.county && <Tag label={p.county} color={C.accent2} />}
        {p.subdivision && p.subdivision !== 'N/A' && <Tag label={p.subdivision} color={C.faint} />}
        {p.listingStatus && p.listingStatus !== 'N/A' && <Tag label={p.listingStatus} color={statusColor} />}
      </div>
      {/* Facts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
        {facts.map(f => (
          <div key={f.label} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 3, padding: '7px 10px' }}>
            <div style={{ fontSize: '0.55rem', color: C.faint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
            <div style={{ fontSize: '0.7rem', color: f.val === 'N/A' ? C.faint : C.text }}>{f.val || 'N/A'}</div>
          </div>
        ))}
      </div>
      {/* Market context */}
      {p.marketContext && (
        <div style={{ fontSize: '0.68rem', color: C.dim, lineHeight: 1.8, marginBottom: 12, paddingLeft: 10, borderLeft: `2px solid ${C.border}` }}>
          {p.marketContext}
        </div>
      )}
      {/* Flags */}
      {p.flags?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.58rem', color: C.red, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5, fontWeight: 500 }}>⚠ Appraiser Flags</div>
          {p.flags.map((f, fi) => (
            <div key={fi} style={{ fontSize: '0.68rem', color: C.red, lineHeight: 1.7 }}>· {f}</div>
          ))}
        </div>
      )}
      {/* Pull manually */}
      {p.pullManually?.length > 0 && (
        <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 3, padding: '8px 12px' }}>
          <div style={{ fontSize: '0.58rem', color: C.faint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Pull Manually — qPublic / FMLS / Schneidercorp</div>
          {p.pullManually.map((item, pi) => (
            <div key={pi} style={{ fontSize: '0.65rem', color: C.dim }}>· {item}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertySection({ properties, emptyMsg }) {
  if (!properties?.length) return <Empty msg={emptyMsg || 'No appraisal appointments found.'} />;
  return <div>{properties.map((p, i) => <PropertyCard key={i} p={p} />)}</div>;
}

function NewsSection({ items }) {
  if (!items?.length) return <Empty msg="No news items retrieved." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map((n, i) => (
        <div key={i} style={{ borderLeft: `2px solid ${C.border}`, paddingLeft: 14, paddingBottom: i < items.length - 1 ? 16 : 0, borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none', marginBottom: i < items.length - 1 ? 4 : 0 }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '0.88rem', fontWeight: 700, color: C.text, marginBottom: 4, lineHeight: 1.4 }}>{n.headline}</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: '0.58rem', color: C.accent, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>{n.source}</span>
            <span style={{ fontSize: '0.58rem', color: C.faint }}>{n.date}</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: C.dim, lineHeight: 1.8 }}>{n.summary}</div>
          {n.url && n.url !== 'N/A' && (
            <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.62rem', color: C.accent2, textDecoration: 'none', marginTop: 5, display: 'inline-block' }}>
              Read full article →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Loading ────────────────────────────────────────────────────────────────────
const STEPS = [
  'Reading Gmail inbox...',
  'Checking outstanding revisions...',
  'Pulling calendar events...',
  'Researching inspection properties...',
  'Searching industry news...',
  'Building action items...',
];

function LoadingBar({ step }) {
  const idx = STEPS.indexOf(step);
  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 4, padding: '20px 24px', marginBottom: 16 }}>
      {STEPS.map((s, i) => {
        const done = i < idx, active = i === idx;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className={active ? 'pulsing' : ''} style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: done ? C.green : active ? C.accent : C.faint,
              transition: 'background 0.3s',
            }} />
            <div style={{ fontSize: '0.7rem', color: done ? C.green : active ? C.accent : C.faint }}>{s}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
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

    // Walk through loading steps visually while API runs
    let i = 0;
    setStep(STEPS[0]);
    const interval = setInterval(() => {
      i = Math.min(i + 1, STEPS.length - 1);
      setStep(STEPS[i]);
    }, 1800);

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
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ fontSize: '0.72rem', color: C.faint }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Morning Briefing — Simmons Appraisals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: '100vh', background: C.bg, padding: '0 0 64px' }}>

        {/* ── Header bar matching toolkit ── */}
        <div style={{
          background: C.bg2, borderBottom: `1px solid ${C.border}`,
          padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28,
        }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '1rem', letterSpacing: '0.06em', color: C.accent, textTransform: 'uppercase' }}>
              Simmons Appraisals
            </div>
            <div style={{ fontSize: '0.6rem', color: C.faint, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Morning Briefing · {today()}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            {state === 'done' && (
              <button className="run-btn" onClick={runBriefing} style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700,
                fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '8px 18px', background: C.bg3, color: C.dim,
                border: `1px solid ${C.border}`, borderRadius: 3,
              }}>↺ Refresh</button>
            )}
            <button onClick={() => signOut({ callbackUrl: '/login' })} style={{
              fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', padding: '7px 14px', background: 'none',
              color: C.faint, border: `1px solid ${C.border}`, borderRadius: 3, cursor: 'pointer',
            }}>Sign Out</button>
          </div>
        </div>

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>

          {/* Run Button */}
          {state === 'idle' && (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, fontSize: '2.4rem', color: C.text, lineHeight: 1.1, marginBottom: 8 }}>
                Morning<br /><span style={{ color: C.accent }}>Briefing</span>
              </div>
              <div style={{ width: 40, height: 2, background: C.accent, margin: '16px auto 24px' }} />
              <div style={{ fontSize: '0.7rem', color: C.dim, marginBottom: 36 }}>
                Click below to pull your Gmail, Calendar, property research, and industry news.
              </div>
              <button className="run-btn" onClick={runBriefing} style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700,
                fontSize: '1rem', letterSpacing: '0.04em',
                padding: '16px 52px', background: C.accent, color: '#fff',
                border: 'none', borderRadius: 3,
              }}>☀ Run Morning Briefing</button>
            </div>
          )}

          {state === 'loading' && <LoadingBar step={step} />}

          {state === 'error' && (
            <div style={{ padding: '16px 18px', background: `${C.red}0d`, border: `1px solid ${C.red}40`, borderRadius: 4, marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', color: C.red, marginBottom: 10 }}>Briefing failed: {error}</div>
              <button className="run-btn" onClick={runBriefing} style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.68rem', padding: '8px 18px', background: C.bg3, color: C.dim, border: `1px solid ${C.border}`, borderRadius: 3 }}>Retry</button>
            </div>
          )}

          {state === 'done' && data && (
            <div>
              <SectionCard icon="⚡" title="Action Items" sub="Priority-ranked for today" accentColor={C.accent} delay="s1">
                <ActionSection items={data.actions} />
              </SectionCard>

              <SectionCard icon="✏️" title="Outstanding Revisions" sub="Inbox only · Corrections folder excluded" accentColor={C.red} delay="s2">
                <RevisionSection items={data.revisions} />
              </SectionCard>

              <SectionCard icon="✉" title="AMC & Client Emails" sub="Last 48 hours · Unread" accentColor={C.accent2} delay="s3">
                <EmailSection emails={data.emails} />
              </SectionCard>

              <SectionCard icon="📅" title="Schedule" sub="Today & tomorrow" accentColor={C.dim} delay="s4">
                <CalendarSection events={data.calendar} />
              </SectionCard>

              <SectionCard icon="🏠" title="Today's Inspection Research" sub="Pre-inspection briefing cards" accentColor={C.accent} delay="s5">
                <PropertySection properties={data.todayProperties} emptyMsg="No appraisal addresses found on today's calendar." />
              </SectionCard>

              <SectionCard icon="🔭" title="Tomorrow's Inspection Research" sub="Pre-inspection briefing cards" accentColor={C.accent2} delay="s6">
                <PropertySection properties={data.tomorrowProperties} emptyMsg="No appraisal addresses found on tomorrow's calendar." />
              </SectionCard>

              <SectionCard icon="📰" title="Industry News" sub="Appraisal & mortgage · Last 7 days" accentColor={C.faint} delay="s7">
                <NewsSection items={data.news} />
              </SectionCard>

              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, paddingTop: 14, fontSize: '0.58rem', color: C.faint, textAlign: 'center', letterSpacing: '0.12em' }}>
                SIMMONS APPRAISALS LLC · GAINESVILLE, GA · LICENSE #338575
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
