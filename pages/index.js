import Head from 'next/head';
import { useState } from 'react';

// ── MCP server URLs ────────────────────────────────────────────────────────────
const MCP_GMAIL    = 'https://gmail.mcp.claude.com/mcp';
const MCP_GCAL     = 'https://gcal.mcp.claude.com/mcp';

// ── Helpers ────────────────────────────────────────────────────────────────────
function today() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function tomorrowLabel() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ── API Calls ──────────────────────────────────────────────────────────────────
async function callProxy(body) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error);
  return data;
}

function extractText(data) {
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function parseJSON(text) {
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

async function fetchEmails() {
  const data = await callProxy({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    mcp_servers: [{ type: 'url', url: MCP_GMAIL, name: 'gmail' }],
    messages: [{
      role: 'user',
      content: 'Search my Gmail for unread emails from the last 48 hours related to appraisal orders, AMC requests, MVS, Opteon, UWM, Pennymac, AppraisalFlo, or any client. For each email return: sender name, subject, date, and a 1-sentence summary of what action (if any) is needed. Return up to 8 emails. Format as JSON array: [{from, subject, date, summary, needsAction}]. Return ONLY valid JSON, no markdown fences.',
    }],
    system: 'You are an assistant helping a residential appraiser review his inbox. Return ONLY valid JSON array, no markdown fences.',
  });
  return parseJSON(extractText(data)) || [];
}

async function fetchRevisions() {
  const data = await callProxy({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    mcp_servers: [{ type: 'url', url: MCP_GMAIL, name: 'gmail' }],
    messages: [{
      role: 'user',
      content: 'Search my Gmail using query: (subject:revision OR subject:revise) -label:Label_8. Label_8 is the INBOX/Corrections folder and those emails are already resolved — exclude them entirely. These are outstanding appraisal revision requests not yet completed. For each email return: sender name, subject, date received, days since received, and a 1-sentence description of what is being requested. Return as JSON array sorted oldest first: [{from, subject, date, daysAgo, description}]. Return ONLY valid JSON, no markdown fences.',
    }],
    system: 'You are an assistant helping a residential real estate appraiser track outstanding revision requests. Exclude Label_8 (INBOX/Corrections) entirely. Return ONLY valid JSON array, no markdown fences.',
  });
  return parseJSON(extractText(data)) || [];
}

async function fetchCalendar() {
  const todayStr = today();
  const tomorrowStr = tomorrowLabel();
  const t = tomorrowISO();

  const data = await callProxy({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    mcp_servers: [{ type: 'url', url: MCP_GCAL, name: 'gcal' }],
    messages: [{
      role: 'user',
      content: `List ALL events on my Google Calendar for today (${todayStr}) and tomorrow (${tomorrowStr}). Use timeMin="${t}T00:00:00" and timeMax="${t}T23:59:59" with timeZone="America/New_York" to ensure tomorrow's events are captured. Check ALL calendars. For each event return: title, start, end, location (if any), note (brief prep note if relevant). Return as JSON array: [{title, start, end, location, note}]. Return ONLY valid JSON, no markdown fences.`,
    }],
    system: 'You are a calendar assistant for a residential real estate appraiser. Check ALL available calendars and return every event. Return ONLY valid JSON array, no markdown fences.',
  });
  return parseJSON(extractText(data)) || [];
}

async function fetchPropertyResearch(calendar) {
  // Extract addresses from tomorrow's calendar events
  const tomorrow = tomorrowISO();
  const addresses = [];
  for (const e of calendar) {
    const start = e.start || '';
    if (!start.includes(tomorrow)) continue;
    const combined = `${e.title || ''} ${e.location || ''}`;
    if (combined.match(/\d{3,5}\s+\w/) && e.location && !addresses.includes(e.location)) {
      addresses.push(e.location);
    }
    if (!e.location && e.title && e.title.match(/\d{3,5}\s+\w/) && !addresses.includes(e.title)) {
      addresses.push(e.title);
    }
  }
  if (!addresses.length) return [];

  const data = await callProxy({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `You are a pre-inspection research assistant for Chris Simmons, a Certified Residential Real Property Appraiser in Gainesville, GA serving North Metro Atlanta and North Georgia (Forsyth, Hall, Cherokee, Gwinnett, Fulton, DeKalb counties).

For each of the following property addresses, search the web and compile a pre-inspection briefing card:

ADDRESSES:
${addresses.map((a, i) => `${i + 1}. ${a}`).join('\n')}

For each return a JSON object:
{
  "address": "full address",
  "county": "county name",
  "subdivision": "subdivision or neighborhood or N/A",
  "propertyType": "e.g. Single Family Residential",
  "beds": "number or N/A",
  "baths": "number or N/A",
  "gla": "sq ft or N/A",
  "yearBuilt": "year or N/A",
  "lotSize": "sq ft or acres or N/A",
  "lastSaleDate": "date or N/A",
  "lastSalePrice": "formatted $ or N/A",
  "estimatedValue": "formatted $ or N/A",
  "estimatedTaxes": "formatted $ or N/A",
  "listingStatus": "Active / Pending / Off-Market / N/A",
  "listPrice": "formatted $ or N/A",
  "dom": "number or N/A",
  "marketContext": "2-3 sentences on neighborhood character, typical price range, and current market conditions",
  "flags": ["list of appraiser flags — off-market sale, flip history, flood zone, FHA indicators, atypical terms, prior appraisal. Empty array if none."],
  "pullManually": ["list of data items that could not be confirmed and need manual qPublic/FMLS/Schneidercorp lookup"]
}

Return a JSON array of these objects, one per address. Return ONLY valid JSON, no markdown fences.`,
    }],
  });
  return parseJSON(extractText(data)) || [];
}

async function fetchNews() {
  const data = await callProxy({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Search for the latest news (last 7 days) on these topics for a Georgia residential real estate appraiser:
1. Fannie Mae / Freddie Mac / GSE appraisal policy updates
2. UAD 3.6 or URAR form changes
3. Residential real estate market conditions (national or Southeast/Georgia)
4. AMC regulations or appraiser independence updates
5. Mortgage rate trends

Return a JSON array of up to 5 news items: [{headline, source, date, summary, url}]. Each summary should be 2-3 sentences. Return ONLY valid JSON, no markdown fences.`,
    }],
  });
  return parseJSON(extractText(data)) || [];
}

async function fetchActionItems(emails, calendar, revisions) {
  const data = await callProxy({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are a concise executive assistant for Chris Simmons, a Certified Residential Real Property Appraiser in Gainesville, GA (Simmons Appraisals LLC). His main AMCs are MVS, Opteon, UWM, and Pennymac.

Generate a prioritized action list for today. Any revision older than 2 days = high priority. Be specific. Return JSON array of up to 6 items: [{priority ("high"|"medium"|"low"), action, context}]

EMAILS: ${JSON.stringify(emails)}
CALENDAR: ${JSON.stringify(calendar)}
REVISIONS: ${JSON.stringify(revisions)}

Return ONLY valid JSON array, no markdown fences.`,
    }],
  });
  return parseJSON(extractText(data)) || [];
}

// ── UI Components ──────────────────────────────────────────────────────────────

function SectionCard({ icon, title, sub, borderColor, className, children }) {
  const leftBorder = borderColor ? `3px solid ${borderColor}` : '1px solid var(--border)';
  const borderStyle = borderColor
    ? { borderLeft: leftBorder, border: `1px solid ${borderColor}30` }
    : { border: '1px solid var(--border)' };

  return (
    <div className={`fade-up ${className || ''}`} style={{
      background: 'var(--bg2)',
      borderRadius: 4,
      padding: '20px 22px',
      marginBottom: 16,
      ...borderStyle,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent)', letterSpacing: '0.02em' }}>{title}</div>
          {sub && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: 'var(--faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Tag({ label, color }) {
  return (
    <span className="tag" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>{label}</span>
  );
}

function EmptyState({ msg }) {
  return <div style={{ color: 'var(--faint)', fontSize: '0.72rem' }}>{msg}</div>;
}

function ActionSection({ items }) {
  if (!items.length) return <EmptyState msg="No action items generated." />;
  const pc = { high: 'var(--red)', medium: 'var(--accent)', low: 'var(--green)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Tag label={item.priority} color={pc[item.priority] || 'var(--dim)'} />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text)', lineHeight: 1.5 }}>{item.action}</div>
            {item.context && <div style={{ fontSize: '0.65rem', color: 'var(--faint)', marginTop: 2, lineHeight: 1.6 }}>{item.context}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function RevisionSection({ items }) {
  if (!items.length) return <div style={{ color: 'var(--green)', fontSize: '0.72rem' }}>✓ No outstanding revisions found.</div>;

  function ageColor(days) {
    const d = parseInt(days) || 0;
    if (d >= 5) return 'var(--red)';
    if (d >= 2) return 'var(--accent)';
    return 'var(--dim)';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--faint)', marginBottom: 8, letterSpacing: '0.08em' }}>
        {items.length} outstanding revision{items.length !== 1 ? 's' : ''} — oldest first
      </div>
      {items.map((r, i) => (
        <div key={i} className="email-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, borderLeft: `2px solid ${ageColor(r.daysAgo)}`, paddingLeft: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 500, fontSize: '0.75rem', color: 'var(--text)' }}>{r.from}</span>
              <Tag label={`${r.daysAgo ?? '?'} days ago`} color={ageColor(r.daysAgo)} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--dim)', marginBottom: 3 }}>{r.subject}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--faint)', lineHeight: 1.6 }}>{r.description}</div>
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--faint)', whiteSpace: 'nowrap', paddingTop: 2 }}>{r.date}</div>
        </div>
      ))}
    </div>
  );
}

function EmailSection({ emails }) {
  if (!emails.length) return <EmptyState msg="No unread AMC/client emails in the last 48 hours." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {emails.map((e, i) => (
        <div key={i} className="email-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 500, fontSize: '0.75rem', color: 'var(--text)' }}>{e.from}</span>
              {e.needsAction && <Tag label="Action" color="var(--accent)" />}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--dim)', marginBottom: 3 }}>{e.subject}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--faint)', lineHeight: 1.6 }}>{e.summary}</div>
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--faint)', whiteSpace: 'nowrap', paddingTop: 2 }}>{e.date}</div>
        </div>
      ))}
    </div>
  );
}

function CalendarSection({ events }) {
  if (!events.length) return <EmptyState msg="No events found for today or tomorrow." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 80, fontSize: '0.65rem', color: 'var(--accent2)', paddingTop: 2, lineHeight: 1.5 }}>
            {e.start ? new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All Day'}
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text)' }}>{e.title}</div>
            {e.location && <div style={{ fontSize: '0.65rem', color: 'var(--faint)', marginTop: 2 }}>📍 {e.location}</div>}
            {e.note && <div style={{ fontSize: '0.65rem', color: 'var(--dim)', marginTop: 3, lineHeight: 1.6 }}>{e.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertyCard({ p }) {
  const statusColor = p.listingStatus === 'Active' ? 'var(--green)' : p.listingStatus === 'Pending' ? 'var(--accent)' : p.listingStatus === 'Off-Market' ? 'var(--red)' : 'var(--faint)';
  const facts = [
    { label: 'Type', val: p.propertyType },
    { label: 'Beds / Baths', val: (p.beds !== 'N/A' || p.baths !== 'N/A') ? `${p.beds} bd / ${p.baths} ba` : 'N/A' },
    { label: 'GLA', val: p.gla !== 'N/A' ? `${p.gla} sf` : 'N/A' },
    { label: 'Year Built', val: p.yearBuilt },
    { label: 'Lot Size', val: p.lotSize },
    { label: 'Est. Value', val: p.estimatedValue },
    { label: 'Last Sale Date', val: p.lastSaleDate },
    { label: 'Last Sale Price', val: p.lastSalePrice },
    { label: 'Est. Taxes/yr', val: p.estimatedTaxes },
  ];

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: 6 }}>{p.address}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {p.county && <Tag label={p.county} color="var(--accent2)" />}
        {p.subdivision && p.subdivision !== 'N/A' && <Tag label={p.subdivision} color="var(--faint)" />}
        {p.listingStatus && p.listingStatus !== 'N/A' && <Tag label={p.listingStatus} color={statusColor} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {facts.map(f => (
          <div key={f.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 3, padding: '8px 10px' }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
            <div style={{ fontSize: '0.72rem', color: f.val === 'N/A' ? 'var(--faint)' : 'var(--text)' }}>{f.val || 'N/A'}</div>
          </div>
        ))}
      </div>
      {p.marketContext && (
        <div style={{ fontSize: '0.7rem', color: 'var(--dim)', lineHeight: 1.8, marginBottom: 12, paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>{p.marketContext}</div>
      )}
      {p.flags && p.flags.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--red)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>⚠ Appraiser Flags</div>
          {p.flags.map((f, fi) => (
            <div key={fi} style={{ fontSize: '0.68rem', color: 'var(--accent)', lineHeight: 1.6 }}>· {f}</div>
          ))}
        </div>
      )}
      {p.pullManually && p.pullManually.length > 0 && (
        <div style={{ background: 'rgba(68,68,85,0.1)', border: '1px solid var(--border)', borderRadius: 3, padding: '8px 12px' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Pull Manually — qPublic / FMLS / Schneidercorp</div>
          {p.pullManually.map((item, pi) => (
            <div key={pi} style={{ fontSize: '0.65rem', color: 'var(--dim)' }}>· {item}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertySection({ properties }) {
  if (!properties.length) return <EmptyState msg="No appraisal appointments found for tomorrow." />;
  return <div>{properties.map((p, i) => <PropertyCard key={i} p={p} />)}</div>;
}

function NewsSection({ items }) {
  if (!items.length) return <EmptyState msg="No news items retrieved." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map((n, i) => (
        <div key={i} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 14 }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.4 }}>{n.headline}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{n.source}</span>
            <span style={{ fontSize: '0.6rem', color: 'var(--faint)' }}>{n.date}</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--dim)', lineHeight: 1.8 }}>{n.summary}</div>
          {n.url && n.url !== 'N/A' && (
            <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.62rem', color: 'var(--accent2)', textDecoration: 'none', marginTop: 5, display: 'inline-block' }}>
              Read full article →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Loading indicator ──────────────────────────────────────────────────────────

const STEPS = [
  'Reading Gmail inbox...',
  'Checking outstanding revisions...',
  'Checking calendar...',
  'Researching tomorrow\'s inspection properties...',
  'Searching appraisal industry news...',
  'Building your action items...',
];

function LoadingIndicator({ currentStep }) {
  const currentIndex = STEPS.indexOf(currentStep);
  return (
    <div style={{ marginBottom: 32 }}>
      {STEPS.map((step, i) => {
        const done   = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--faint)',
              transition: 'background 0.3s',
            }} className={active ? 'pulsing' : ''} />
            <div style={{ fontSize: '0.72rem', color: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--faint)' }}>{step}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MorningBriefing() {
  const [state, setState]             = useState('idle');
  const [loadingStep, setLoadingStep] = useState('');
  const [data, setData]               = useState(null);
  const [error, setError]             = useState('');

  async function runBriefing() {
    setState('loading');
    setData(null);
    setError('');

    try {
      setLoadingStep(STEPS[0]);
      let emails = [];
      try { emails = await fetchEmails(); } catch (e) { console.warn(e); }

      setLoadingStep(STEPS[1]);
      let revisions = [];
      try { revisions = await fetchRevisions(); } catch (e) { console.warn(e); }

      setLoadingStep(STEPS[2]);
      let calendar = [];
      try { calendar = await fetchCalendar(); } catch (e) { console.warn(e); }

      setLoadingStep(STEPS[3]);
      let properties = [];
      try { properties = await fetchPropertyResearch(calendar); } catch (e) { console.warn(e); }

      setLoadingStep(STEPS[4]);
      let news = [];
      try { news = await fetchNews(); } catch (e) { console.warn(e); }

      setLoadingStep(STEPS[5]);
      let actions = [];
      try { actions = await fetchActionItems(emails, calendar, revisions); } catch (e) { console.warn(e); }

      setData({ emails, revisions, calendar, properties, news, actions });
      setState('done');
    } catch (e) {
      setError(e.message);
      setState('error');
    }
  }

  return (
    <>
      <Head>
        <title>Morning Briefing — Simmons Appraisals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 24px 64px', maxWidth: 820, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
            Simmons Appraisals LLC
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 2.8rem)', color: 'var(--text)', lineHeight: 1.1, marginBottom: 8 }}>
            Morning<br /><span style={{ color: 'var(--accent)' }}>Briefing</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--faint)', letterSpacing: '0.08em' }}>{today()}</div>
        </div>

        {/* ── Run Button ── */}
        {state === 'idle' && (
          <button
            className="run-btn"
            onClick={runBriefing}
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 700,
              fontSize: '0.95rem',
              letterSpacing: '0.04em',
              padding: '16px 44px',
              background: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 4,
              marginBottom: 32,
            }}
          >
            ☀ Run Morning Briefing
          </button>
        )}

        {/* ── Loading ── */}
        {state === 'loading' && <LoadingIndicator currentStep={loadingStep} />}

        {/* ── Error ── */}
        {state === 'error' && (
          <div style={{ padding: '16px 18px', background: 'rgba(224,112,112,0.07)', border: '1px solid rgba(224,112,112,0.3)', borderRadius: 4, marginBottom: 24 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--red)', marginBottom: 10 }}>Briefing failed: {error}</div>
            <button className="run-btn" onClick={runBriefing} style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', padding: '8px 20px', background: 'var(--bg3)', color: 'var(--dim)', border: '1px solid var(--border)', borderRadius: 3 }}>
              Retry
            </button>
          </div>
        )}

        {/* ── Results ── */}
        {state === 'done' && data && (
          <div>
            <button className="run-btn" onClick={runBriefing} style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 20px', background: 'var(--bg3)', color: 'var(--dim)', border: '1px solid var(--border)', borderRadius: 3, marginBottom: 28 }}>
              ↺ Refresh Briefing
            </button>

            <SectionCard icon="⚡" title="Today's Action Items" sub="Priority-ranked tasks" borderColor="var(--accent)" className="s1">
              <ActionSection items={data.actions} />
            </SectionCard>

            <SectionCard icon="✏️" title="Outstanding Revisions" sub="All unresolved — Corrections folder excluded" borderColor="var(--red)" className="s2">
              <RevisionSection items={data.revisions} />
            </SectionCard>

            <SectionCard icon="✉" title="AMC & Client Emails" sub="Last 48 hours — unread" className="s3">
              <EmailSection emails={data.emails} />
            </SectionCard>

            <SectionCard icon="📅" title="Schedule" sub="Today & tomorrow" className="s4">
              <CalendarSection events={data.calendar} />
            </SectionCard>

            <SectionCard icon="🏠" title="Pre-Inspection Property Research" sub="Tomorrow's appointments — auto-researched" borderColor="var(--accent2)" className="s5">
              <PropertySection properties={data.properties} />
            </SectionCard>

            <SectionCard icon="📰" title="Industry News" sub="Appraisal & mortgage — last 7 days" className="s6">
              <NewsSection items={data.news} />
            </SectionCard>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 16, fontSize: '0.6rem', color: 'var(--faint)', textAlign: 'center', letterSpacing: '0.1em' }}>
              SIMMONS APPRAISALS LLC · GAINESVILLE, GA · LICENSE #338575
            </div>
          </div>
        )}
      </div>
    </>
  );
}
