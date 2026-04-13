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
  const addresses = [];
  for (const e of events) {
    const loc = e.location?.trim();
    if (loc && loc.match(/\d{3,5}\s+\w/) && !addresses.find(a => a.address === loc)) {
      addresses.push({ address: loc, eventTitle: e.title, eventStart: e.start });
    } else if (!loc && e.title?.match(/\d{3,5}\s+\w/) && !addresses.find(a => a.address === e.title)) {
      addresses.push({ address: e.title, eventTitle: e.title, eventStart: e.start });
    }
  }
  return addresses;
}

async function summarizeEmails(emails) {
  if (!emails.length) return [];
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Residential appraiser inbox assistant. For each email, write a 1-sentence action summary and set needsAction true/false. Return JSON array: [{from, subject, date, summary, needsAction}]

EMAILS: ${JSON.stringify(emails.map(e => ({ from: e.from, subject: e.subject, date: e.date, snippet: e.snippet })))}

Return ONLY valid JSON array, no markdown.`,
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
      content: `Appraisal revision tracker. For each email write a 1-sentence description of what revision is being requested. Return JSON array: [{from, subject, date, daysAgo, description}]

REVISIONS: ${JSON.stringify(revisions.map(r => ({ from: r.from, subject: r.subject, date: r.date, daysAgo: r.daysAgo, snippet: r.snippet })))}

Return ONLY valid JSON array, no markdown.`,
    }],
  });
  return parseJSON(text) || revisions.map(r => ({ ...r, description: r.snippet }));
}

async function getPropertyResearch(addressItems) {
  if (!addressItems.length) return [];
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3500,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Pre-inspection research assistant for Chris Simmons, Certified Residential Real Property Appraiser, Gainesville GA. Serves North Metro Atlanta and North Georgia (Forsyth, Hall, Cherokee, Gwinnett, Fulton, DeKalb counties).

Research each address below and return a briefing card:

ADDRESSES:
${addressItems.map((a, i) => `${i + 1}. ${a.address} (Inspection time: ${a.eventStart ? new Date(a.eventStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'TBD'})`).join('\n')}

For each return:
{
  "address": "full address",
  "inspectionTime": "time string",
  "county": "county name",
  "subdivision": "subdivision or N/A",
  "propertyType": "Single Family Residential etc",
  "beds": "number or N/A",
  "baths": "number or N/A",
  "gla": "sq ft or N/A",
  "yearBuilt": "year or N/A",
  "lotSize": "sq ft or acres or N/A",
  "lastSaleDate": "date or N/A",
  "lastSalePrice": "$ or N/A",
  "estimatedValue": "$ or N/A",
  "estimatedTaxes": "$ or N/A",
  "listingStatus": "Active / Pending / Off-Market / N/A",
  "listPrice": "$ or N/A",
  "dom": "number or N/A",
  "marketContext": "2-3 sentences on neighborhood, price range, market conditions",
  "flags": ["appraiser flags — off-market, flip, flood zone, FHA, prior appraisal. Empty if none."],
  "pullManually": ["items needing qPublic/FMLS/Schneidercorp lookup"]
}

Return JSON array, one per address. ONLY valid JSON, no markdown.`,
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
      content: `Latest appraisal/mortgage industry news (last 7 days) for a Georgia residential appraiser. Topics:
1. Fannie Mae/Freddie Mac/GSE appraisal policy
2. UAD 3.6/URAR form changes
3. SE/Georgia real estate market conditions
4. AMC regulations/appraiser independence
5. Mortgage rate trends

Return JSON array of up to 5 items: [{headline, source, date, summary, url}]. 2-3 sentence summaries. ONLY valid JSON.`,
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
      content: `Executive assistant for Chris Simmons, Certified Residential Real Property Appraiser, Gainesville GA (Simmons Appraisals LLC). AMCs: MVS, Opteon, UWM, Pennymac.

Prioritized action list for today. Revisions 2+ days old = high priority. Be specific. Return JSON array of up to 6 items: [{priority ("high"|"medium"|"low"), action, context}]

EMAILS: ${JSON.stringify(emails)}
CALENDAR: ${JSON.stringify(calendar)}
REVISIONS: ${JSON.stringify(revisions)}

ONLY valid JSON array, no markdown.`,
    }],
  });
  return parseJSON(text) || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Not authenticated' });

  const { accessToken, refreshToken } = session;

  try {
    // Fetch all Google data in parallel
    const [rawEmails, rawRevisions, calendar, todayEvents, tomorrowEvents] = await Promise.all([
      getUnreadEmails(accessToken, refreshToken).catch(() => []),
      getRevisions(accessToken, refreshToken).catch(() => []),
      getCalendarEvents(accessToken, refreshToken).catch(() => []),
      getTodayEvents(accessToken, refreshToken).catch(() => []),
      getTomorrowEvents(accessToken, refreshToken).catch(() => []),
    ]);

    // Extract addresses from both today AND tomorrow
    const todayAddresses    = extractAddresses(todayEvents);
    const tomorrowAddresses = extractAddresses(tomorrowEvents);
    const allAddresses      = [
      ...todayAddresses.map(a => ({ ...a, day: 'today' })),
      ...tomorrowAddresses.map(a => ({ ...a, day: 'tomorrow' })),
    ];

    // Run Claude analysis in parallel
    const [emails, revisions, allProperties, news] = await Promise.all([
      summarizeEmails(rawEmails).catch(() => rawEmails),
      summarizeRevisions(rawRevisions).catch(() => rawRevisions),
      getPropertyResearch(allAddresses).catch(() => []),
      getNews().catch(() => []),
    ]);

    const actions = await getActionItems(emails, calendar, revisions).catch(() => []);

    // Split properties back into today/tomorrow
    const todayAddressStrings    = todayAddresses.map(a => a.address);
    const tomorrowAddressStrings = tomorrowAddresses.map(a => a.address);
    const todayProperties    = allProperties.filter(p => todayAddressStrings.some(a => p.address?.includes(a.split(',')[0])));
    const tomorrowProperties = allProperties.filter(p => tomorrowAddressStrings.some(a => p.address?.includes(a.split(',')[0])));

    return res.status(200).json({
      emails, revisions, calendar,
      todayProperties, tomorrowProperties,
      news, actions,
    });
  } catch (err) {
    console.error('Briefing error:', err);
    return res.status(500).json({ error: err.message });
  }
}
