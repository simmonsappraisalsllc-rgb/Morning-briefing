export const config = {
  maxDuration: 60,
};

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
    const candidates   = [loc, titleCleaned].filter(Boolean);
    for (const candidate of candidates) {
      if (!candidate.match(/\d{3,5}\s+[a-zA-Z]/)) continue;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      let timeStr = 'TBD';
      try { if (e.start) timeStr = new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }); } catch {}
      results.push({ address: candidate, eventTitle: e.title || '', eventStart: e.start || '', timeStr });
      break;
    }
  }
  return results;
}

async function researchOneAddress(item) {
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Pre-inspection research for Chris Simmons, Certified Residential Real Property Appraiser, Gainesville GA (Forsyth, Hall, Cherokee, Gwinnett, Fulton, DeKalb counties).

Search the web for: ${item.address}

Return ONE JSON object (use "N/A" for missing data):
{"address":"${item.address}","inspectionTime":"${item.timeStr}","county":"","subdivision":"","propertyType":"","beds":"","baths":"","gla":"","yearBuilt":"","lotSize":"","lastSaleDate":"","lastSalePrice":"","estimatedValue":"","estimatedTaxes":"","listingStatus":"","listPrice":"","dom":"","marketContext":"2-3 sentences on neighborhood, price range, market conditions","flags":[],"pullManually":[]}

Return ONLY the JSON object, no markdown.`,
    }],
  });
  return parseJSON(text);
}

async function getPropertyResearch(addressItems) {
  if (!addressItems.length) return [];
  const results = [];
  for (const item of addressItems) {
    try {
      const r = await researchOneAddress(item);
      if (r) results.push(r);
      else throw new Error('parse failed');
    } catch (e) {
      console.error('Research failed for', item.address, e.message);
      results.push({
        address: item.address, inspectionTime: item.timeStr,
        county: 'N/A', subdivision: 'N/A', propertyType: 'Single Family Residential',
        beds: 'N/A', baths: 'N/A', gla: 'N/A', yearBuilt: 'N/A', lotSize: 'N/A',
        lastSaleDate: 'N/A', lastSalePrice: 'N/A', estimatedValue: 'N/A', estimatedTaxes: 'N/A',
        listingStatus: 'N/A', listPrice: 'N/A', dom: 'N/A',
        marketContext: 'Web research timed out or failed. Pull all data manually.',
        flags: [], pullManually: ['All fields — research failed, use qPublic and FMLS'],
      });
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
    messages: [{ role: 'user', content: `Latest appraisal/mortgage industry news (last 7 days) for a Georgia residential appraiser. GSE/Fannie/Freddie policy, UAD 3.6, SE Georgia market, AMC regulations, mortgage rates.\nReturn JSON array of up to 5: [{headline, source, date, summary, url}]. ONLY valid JSON array.` }],
  });
  return parseJSON(text) || [];
}

async function getActionItems(emails, calendar, revisions) {
  const text = await callClaude({
    model: 'claude-sonnet-4-20250514', max_tokens: 800,
    messages: [{ role: 'user', content: `Executive assistant for Chris Simmons, Certified Residential Real Property Appraiser, Gainesville GA (Simmons Appraisals LLC). AMCs: MVS, Opteon, UWM, Pennymac. Revisions 2+ days old = high priority. Return JSON array of up to 6: [{priority ("high"|"medium"|"low"), action, context}]\nEMAILS: ${JSON.stringify(emails)}\nCALENDAR: ${JSON.stringify(calendar)}\nREVISIONS: ${JSON.stringify(revisions)}\nONLY valid JSON array.` }],
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
      getUnreadEmails(accessToken, refreshToken).catch(e => { console.error('emails:', e.message); return []; }),
      getRevisions(accessToken, refreshToken).catch(e => { console.error('revisions:', e.message); return []; }),
      getCalendarEvents(accessToken, refreshToken).catch(e => { console.error('calendar:', e.message); return []; }),
      getTodayEvents(accessToken, refreshToken).catch(e => { console.error('today:', e.message); return []; }),
      getTomorrowEvents(accessToken, refreshToken).catch(e => { console.error('tomorrow:', e.message); return []; }),
    ]);

    const todayAddresses    = extractAddresses(todayEvents);
    const tomorrowAddresses = extractAddresses(tomorrowEvents);
    const allAddresses      = [...todayAddresses, ...tomorrowAddresses];

    console.log('Today addresses extracted:', JSON.stringify(todayAddresses.map(a => a.address)));
    console.log('Tomorrow addresses extracted:', JSON.stringify(tomorrowAddresses.map(a => a.address)));

    // Run email/revision summaries and news in parallel, property research sequential (web search needs time)
    const [[emails, revisions, news], allProperties] = await Promise.all([
      Promise.all([
        summarizeEmails(rawEmails).catch(() => rawEmails),
        summarizeRevisions(rawRevisions).catch(() => rawRevisions),
        getNews().catch(() => []),
      ]),
      getPropertyResearch(allAddresses).catch(e => { console.error('property research error:', e.message); return []; }),
    ]);

    const actions = await getActionItems(emails, calendar, revisions).catch(() => []);

    // Split by order since we built allAddresses = [...today, ...tomorrow]
    const todayProps    = allProperties.slice(0, todayAddresses.length);
    const tomorrowProps = allProperties.slice(todayAddresses.length);

    return res.status(200).json({
      emails, revisions, calendar,
      todayProperties: todayProps,
      tomorrowProperties: tomorrowProps,
      news, actions,
    });
  } catch (err) {
    console.error('Briefing handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
