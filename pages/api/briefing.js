import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getUnreadEmails, getRevisions, getCalendarEvents, getTomorrowEvents } from '../../lib/google';

async function callClaude(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function parseJSON(text) {
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
  catch { return null; }
}

async function summarizeEmails(emails) {
  if (!emails.length) return [];
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `You are an assistant helping a residential appraiser review his inbox. For each email below, write a 1-sentence action summary and determine if it needs action today (true/false). Return JSON array: [{from, subject, date, summary, needsAction}]

EMAILS:
${JSON.stringify(emails.map(e => ({ from: e.from, subject: e.subject, date: e.date, snippet: e.snippet })))}

Return ONLY valid JSON array, no markdown fences.`,
    }],
  });
  return parseJSON(text) || emails;
}

async function summarizeRevisions(revisions) {
  if (!revisions.length) return [];
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are an assistant helping a residential appraiser track outstanding revision requests. For each revision email below, write a 1-sentence description of what is being requested. Return JSON array: [{from, subject, date, daysAgo, description}]

REVISIONS:
${JSON.stringify(revisions.map(r => ({ from: r.from, subject: r.subject, date: r.date, daysAgo: r.daysAgo, snippet: r.snippet })))}

Return ONLY valid JSON array, no markdown fences.`,
    }],
  });
  return parseJSON(text) || revisions.map(r => ({ ...r, description: r.snippet }));
}

async function getPropertyResearch(tomorrowEvents) {
  // Extract addresses from tomorrow's events
  const addresses = [];
  for (const e of tomorrowEvents) {
    const loc = e.location?.trim();
    if (loc && loc.match(/\d{3,5}\s+\w/) && !addresses.includes(loc)) {
      addresses.push(loc);
    }
    if (!loc && e.title?.match(/\d{3,5}\s+\w/) && !addresses.includes(e.title)) {
      addresses.push(e.title);
    }
  }
  if (!addresses.length) return [];

  const text = await callClaude({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `You are a pre-inspection research assistant for Chris Simmons, Certified Residential Real Property Appraiser in Gainesville, GA serving North Metro Atlanta and North Georgia (Forsyth, Hall, Cherokee, Gwinnett, Fulton, DeKalb counties).

For each address below, search the web and compile a pre-inspection briefing card:

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
  "marketContext": "2-3 sentences on neighborhood character, price range, and market conditions",
  "flags": ["appraiser flags — off-market, flip history, flood zone, FHA indicators, prior appraisal. Empty array if none."],
  "pullManually": ["data items not confirmed — need qPublic/FMLS/Schneidercorp lookup"]
}

Return a JSON array, one object per address. Return ONLY valid JSON, no markdown fences.`,
    }],
  });
  return parseJSON(text) || [];
}

async function getNews() {
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Search for the latest news (last 7 days) for a Georgia residential real estate appraiser on:
1. Fannie Mae / Freddie Mac / GSE appraisal policy updates
2. UAD 3.6 or URAR form changes
3. Residential real estate market conditions (national or Southeast/Georgia)
4. AMC regulations or appraiser independence updates
5. Mortgage rate trends

Return JSON array of up to 5 items: [{headline, source, date, summary, url}]. 2-3 sentence summaries. Return ONLY valid JSON, no markdown fences.`,
    }],
  });
  return parseJSON(text) || [];
}

async function getActionItems(emails, calendar, revisions) {
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `You are a concise executive assistant for Chris Simmons, Certified Residential Real Property Appraiser, Gainesville GA (Simmons Appraisals LLC). AMCs: MVS, Opteon, UWM, Pennymac.

Generate a prioritized action list for today. Revisions older than 2 days = high priority. Be specific. Return JSON array of up to 6 items: [{priority ("high"|"medium"|"low"), action, context}]

EMAILS: ${JSON.stringify(emails)}
CALENDAR: ${JSON.stringify(calendar)}
REVISIONS: ${JSON.stringify(revisions)}

Return ONLY valid JSON array, no markdown fences.`,
    }],
  });
  return parseJSON(text) || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { accessToken, refreshToken } = session;

  try {
    // Fetch Google data in parallel where possible
    const [rawEmails, rawRevisions, calendar, tomorrowEvents] = await Promise.all([
      getUnreadEmails(accessToken, refreshToken).catch(() => []),
      getRevisions(accessToken, refreshToken).catch(() => []),
      getCalendarEvents(accessToken, refreshToken).catch(() => []),
      getTomorrowEvents(accessToken, refreshToken).catch(() => []),
    ]);

    // Run Claude analysis in parallel
    const [emails, revisions, properties, news] = await Promise.all([
      summarizeEmails(rawEmails).catch(() => rawEmails),
      summarizeRevisions(rawRevisions).catch(() => rawRevisions),
      getPropertyResearch(tomorrowEvents).catch(() => []),
      getNews().catch(() => []),
    ]);

    const actions = await getActionItems(emails, calendar, revisions).catch(() => []);

    return res.status(200).json({ emails, revisions, calendar, properties, news, actions });
  } catch (err) {
    console.error('Briefing error:', err);
    return res.status(500).json({ error: err.message });
  }
}
