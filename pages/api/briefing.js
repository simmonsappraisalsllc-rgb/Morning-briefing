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

// ── Robust address extractor ───────────────────────────────────────────────────
// Handles: "5436 Gallery Ct, Dunwoody", "Inspect: 1720 Lazy River Ln",
//          "Appraisal: 2875 Englewood Drive, Cumming, GA 30040"
function extractAddresses(events) {
  const seen = new Set();
  const results = [];

  for (const e of events) {
    // Try location field first (most reliable)
    const loc = (e.location || '').trim();
    // Try title field as fallback (strip prefixes like "Inspect:", "Appraisal:")
    const titleCleaned = (e.title || '').replace(/^(inspect|appraisal|inspection|survey|appt|appointment)\s*:\s*/i, '').trim();

    const candidates = [loc, titleCleaned].filter(Boolean);

    for (const candidate of candidates) {
      // Must contain a street number (3-5 digits followed by a word char)
      if (!candidate.match(/\d{3,5}\s+[a-zA-Z]/)) continue;
      if (seen.has(candidate)) continue;
      seen.add(candidate);

      let timeStr = 'TBD';
      try {
        if (e.start) {
          timeStr = new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
        }
      } catch {}

      results.push({
        address:    candidate,
        eventTitle: e.title || '',
        eventStart: e.start || '',
        timeStr,
      });
      break; // Only take one address per event
    }
  }
  return results;
}

// ── Claude analysis functions ──────────────────────────────────────────────────

async function summarizeEmails(emails) {
  if (!emails.length) return [];
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514', max_tokens: 800,
    messages: [{ role: 'user', content: `Residential appraiser inbox. For each email write a 1-sentence action summary, set needsAction true/false. Return JSON array: [{from, subject, date, summary, needsAction}]\n\nEMAILS: ${JSON.stringify(emails.map(e => ({ from: e.from, subject: e.subject, date: e.date, snippet: e.snippet })))}\n\nReturn ONLY valid JSON array.` }],
  });
  return parseJSON(text) || emails;
}

async function summarizeRevisions(revisions) {
  if (!revisions.length) return [];
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514', max_tokens: 1000,
    messages: [{ role: 'user', content: `Appraisal revision tracker. For each email write a 1-sentence description of what revision is requested. Return JSON array: [{from, subject, date, daysAgo, description}]\n\nREVISIONS: ${JSON.stringify(revisions.map(r => ({ from: r.from, subject: r.subject, date: r.date, daysAgo: r.daysAgo, snippet: r.snippet })))}\n\nReturn ONLY valid JSON array.` }],
  });
  return parseJSON(text) || revisions.map(r => ({ ...r, description: r.snippet }));
}

async function getPropertyResearch(addressItems) {
  if (!addressItems.length) return [];
  console.log('Researching addresses:', addressItems.map(a => a.address));

  const text = await callClaude({
    model: 'claude-sonnet-4-20250514', max_tokens: 4000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `You are a pre-inspection research assistant for Chris Simmons, Certified Residential Real Property Appraiser in Gainesville, GA. He serves North Metro Atlanta and North Georgia (Forsyth, Hall, Cherokee, Gwinnett, Fulton, DeKalb counties).

Search the web for each address below and compile a briefing card. Search each one individually.

ADDRESSES TO RESEARCH:
${addressItems.map((a, i) => `${i + 1}. ${a.address} — Inspection time: ${a.timeStr}`).join('\n')}

For EACH address return one JSON object with these fields:
{
  "address": "full address as provided",
  "inspectionTime": "inspection time string",
  "county": "county name",
  "subdivision": "subdivision/neighborhood or N/A",
  "propertyType": "Single Family Residential etc",
  "beds": "number or N/A",
  "baths": "number or N/A",
  "gla": "sq ft number only or N/A",
  "yearBuilt": "4-digit year or N/A",
  "lotSize": "e.g. 0.25 acres or 10,890 sf or N/A",
  "lastSaleDate": "Month YYYY or N/A",
  "lastSalePrice": "$XXX,XXX or N/A",
  "estimatedValue": "$XXX,XXX or N/A",
  "estimatedTaxes": "$X,XXX/yr or N/A",
  "listingStatus": "Active / Pending / Off-Market / N/A",
  "listPrice": "$XXX,XXX or N/A",
  "dom": "number or N/A",
  "marketContext": "2-3 sentences on neighborhood, typical price range, and current market conditions",
  "flags": ["any appraiser flags: off-market sale, flip pattern, flood zone, FHA indicators, prior appraisal history, unusual characteristics"],
  "pullManually": ["specific data items not found online that need qPublic/FMLS/Schneidercorp lookup"]
}

Return a JSON ARRAY with one object per address. If you cannot find data for a field set it to "N/A". Return ONLY valid JSON array, no markdown fences, no preamble.`,
    }],
  });
  const parsed = parseJSON(text);
  console.log('Property research result:', parsed ? `${parsed.length} properties` : 'parse failed');
  return parsed || [];
}

async function getNews() {
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514', max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: `Latest appraisal/mortgage industry news (last 7 days) for a Georgia residential appraiser. Topics: GSE/Fannie/Freddie policy, UAD 3.6/URAR, SE Georgia market conditions, AMC regulations, mortgage rates.\n\nReturn JSON array of up to 5 items: [{headline, source, date, summary, url}]. 2-3 sentence summaries. ONLY valid JSON array.` }],
  });
  return parseJSON(text) || [];
}

async function getActionItems(emails, calendar, revisions) {
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514', max_tokens: 800,
    messages: [{ role: 'user', content: `Executive assistant for Chris Simmons, Certified Residential Real Property Appraiser, Gainesville GA (Simmons Appraisals LLC). AMCs: MVS, Opteon, UWM, Pennymac. Revisions 2+ days old = high priority. Return prioritized JSON array of up to 6 items: [{priority ("high"|"medium"|"low"), action, context}]\n\nEMAILS: ${JSON.stringify(emails)}\nCALENDAR: ${JSON.stringify(calendar)}\nREVISIONS: ${JSON.stringify(revisions)}\n\nONLY valid JSON array.` }],
  });
  return parseJSON(text) || [];
}

// ── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Not authenticated' });

  const { accessToken, refreshToken } = session;

  try {
    const [rawEmails, rawRevisions, calendar, todayEvents, tomorrowEvents] = await Promise.all([
      getUnreadEmails(accessToken, refreshToken).catch(e => { console.error('emails:', e); return []; }),
      getRevisions(accessToken, refreshToken).catch(e => { console.error('revisions:', e); return []; }),
      getCalendarEvents(accessToken, refreshToken).catch(e => { console.error('calendar:', e); return []; }),
      getTodayEvents(accessToken, refreshToken).catch(e => { console.error('today:', e); return []; }),
      getTomorrowEvents(accessToken, refreshToken).catch(e => { console.error('tomorrow:', e); return []; }),
    ]);

    const todayAddresses    = extractAddresses(todayEvents);
    const tomorrowAddresses = extractAddresses(tomorrowEvents);

    console.log('Today events:', todayEvents.length, '→ addresses:', todayAddresses.map(a => a.address));
    console.log('Tomorrow events:', tomorrowEvents.length, '→ addresses:', tomorrowAddresses.map(a => a.address));

    const allAddresses = [...todayAddresses, ...tomorrowAddresses];

    const [emails, revisions, allProperties, news] = await Promise.all([
      summarizeEmails(rawEmails).catch(() => rawEmails),
      summarizeRevisions(rawRevisions).catch(() => rawRevisions),
      getPropertyResearch(allAddresses).catch(e => { console.error('property research:', e); return []; }),
      getNews().catch(() => []),
    ]);

    const actions = await getActionItems(emails, calendar, revisions).catch(() => []);

    // Match properties back to today vs tomorrow by address prefix
    const todayAddrSet    = new Set(todayAddresses.map(a => a.address.split(',')[0].toLowerCase().trim()));
    const tomorrowAddrSet = new Set(tomorrowAddresses.map(a => a.address.split(',')[0].toLowerCase().trim()));

    const todayProperties    = allProperties.filter(p => {
      const key = (p.address || '').split(',')[0].toLowerCase().trim();
      return todayAddrSet.has(key) || todayAddresses.some(a => p.address?.toLowerCase().includes(a.address.split(',')[0].toLowerCase()));
    });
    const tomorrowProperties = allProperties.filter(p => {
      const key = (p.address || '').split(',')[0].toLowerCase().trim();
      return tomorrowAddrSet.has(key) || tomorrowAddresses.some(a => p.address?.toLowerCase().includes(a.address.split(',')[0].toLowerCase()));
    });

    return res.status(200).json({ emails, revisions, calendar, todayProperties, tomorrowProperties, news, actions });
  } catch (err) {
    console.error('Briefing error:', err);
    return res.status(500).json({ error: err.message });
  }
}
