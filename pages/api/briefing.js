import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getUnreadEmails, getRevisions, getCalendarEvents, getTodayEvents, getTomorrowEvents } from '../../lib/google';

async function callClaude(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function parseJSON(raw) {
  try { return JSON.parse(raw.replace(/```json|```/g, '').trim()); }
  catch { return null; }
}

function extractAddresses(events) {
  const seen = new Set();
  const results = [];
  for (const e of events) {
    const loc          = (e.location || '').trim();
    const titleCleaned = (e.title || '').replace(/^(inspect|appraisal|inspection|survey|appt|appointment)\s*:\s*/i, '').trim();
    for (const candidate of [loc, titleCleaned].filter(Boolean)) {
      if (!candidate.match(/\d{3,5}\s+[a-zA-Z]/)) continue;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      let timeStr = 'TBD';
      try { if (e.start) timeStr = new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }); } catch {}
      results.push({ address: candidate, timeStr });
      break;
    }
  }
  return results;
}

async function summarizeEmails(emails) {
  if (!emails.length) return [];
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514', max_tokens: 800,
    messages: [{ role: 'user', content: `Residential appraiser inbox. For each email write a 1-sentence action summary, set needsAction true/false. Return JSON array: [{from, subject, date, summary, needsAction}]\nEMAILS: ${JSON.stringify(emails.map(e => ({ from: e.from, subject: e.subject, date: e.date, snippet: e.snippet })))}\nReturn ONLY valid JSON array.` }],
  });
  return parseJSON(text) || emails;
}

async function summarizeRevisions(revisions) {
  if (!revisions.length) return [];
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514', max_tokens: 1000,
    messages: [{ role: 'user', content: `Appraisal revision tracker. For each email write a 1-sentence description of what revision is requested. Return JSON array: [{from, subject, date, daysAgo, description}]\nREVISIONS: ${JSON.stringify(revisions.map(r => ({ from: r.from, subject: r.subject, date: r.date, daysAgo: r.daysAgo, snippet: r.snippet })))}\nReturn ONLY valid JSON array.` }],
  });
  return parseJSON(text) || revisions.map(r => ({ ...r, description: r.snippet }));
}

async function getNews() {
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514', max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: `Latest appraisal/mortgage news (last 7 days) for Georgia residential appraiser. GSE/Fannie/Freddie policy, UAD 3.6, SE Georgia market, AMC regulations, mortgage rates.\nReturn JSON array of up to 5: [{headline, source, date, summary, url}]. ONLY valid JSON array.` }],
  });
  return parseJSON(text) || [];
}

async function getActionItems(emails, calendar, revisions) {
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514', max_tokens: 800,
    messages: [{ role: 'user', content: `Executive assistant for Chris Simmons, Certified Residential Real Property Appraiser, Gainesville GA. AMCs: MVS, Opteon, UWM, Pennymac. Revisions 2+ days old = high priority. Return JSON array of up to 6: [{priority ("high"|"medium"|"low"), action, context}]\nEMAILS: ${JSON.stringify(emails)}\nCALENDAR: ${JSON.stringify(calendar)}\nREVISIONS: ${JSON.stringify(revisions)}\nONLY valid JSON array.` }],
  });
  return parseJSON(text) || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Not authenticated' });

  const { accessToken, refreshToken } = session;

  try {
    const [rawEmails, rawRevisions, calendar, todayEvents, tomorrowEvents] = await Promise.all([
      getUnreadEmails(accessToken, refreshToken).catch(() => []),
      getRevisions(accessToken, refreshToken).catch(() => []),
      getCalendarEvents(accessToken, refreshToken).catch(() => []),
      getTodayEvents(accessToken, refreshToken).catch(() => []),
      getTomorrowEvents(accessToken, refreshToken).catch(() => []),
    ]);

    const todayAddresses    = extractAddresses(todayEvents);
    const tomorrowAddresses = extractAddresses(tomorrowEvents);

    const [emails, revisions, news] = await Promise.all([
      summarizeEmails(rawEmails).catch(() => rawEmails),
      summarizeRevisions(rawRevisions).catch(() => rawRevisions),
      getNews().catch(() => []),
    ]);

    const actions = await getActionItems(emails, calendar, revisions).catch(() => []);

    return res.status(200).json({
      emails, revisions, calendar,
      todayAddresses,    // send raw addresses to client for research
      tomorrowAddresses,
      news, actions,
    });
  } catch (err) {
    console.error('Briefing error:', err);
    return res.status(500).json({ error: err.message });
  }
}
