import { google } from 'googleapis';

function getOAuthClient(accessToken, refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token:  accessToken,
    refresh_token: refreshToken,
  });
  return oauth2Client;
}

// ── Gmail ──────────────────────────────────────────────────────────────────────

export async function getUnreadEmails(accessToken, refreshToken) {
  const auth  = getOAuthClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  // Inbox only, unread, last 48hrs, AMC/appraisal related
  const q = 'in:inbox is:unread newer_than:2d (from:MVS OR from:Opteon OR from:UWM OR from:Pennymac OR from:AppraisalFlo OR subject:appraisal OR subject:order OR subject:inspection)';
  const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 8 });
  const msgs = list.data.messages || [];

  const results = [];
  for (const m of msgs.slice(0, 8)) {
    const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
    const hdrs = msg.data.payload.headers;
    const get  = (name) => hdrs.find(h => h.name === name)?.value || '';
    results.push({
      from:    get('From'),
      subject: get('Subject'),
      date:    get('Date'),
      snippet: msg.data.snippet || '',
    });
  }
  return results;
}

export async function getRevisions(accessToken, refreshToken) {
  const auth  = getOAuthClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  // INBOX ONLY — exclude trash, spam, deleted, and Label_8 (Corrections/already handled)
  const q = 'in:inbox (subject:revision OR subject:revise) -label:Label_8';
  const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 25 });
  const msgs = list.data.messages || [];

  const results = [];
  const now = Date.now();
  for (const m of msgs) {
    const msg  = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
    const hdrs = msg.data.payload.headers;
    const get  = (name) => hdrs.find(h => h.name === name)?.value || '';
    const dateStr = get('Date');
    const daysAgo = dateStr ? Math.floor((now - new Date(dateStr).getTime()) / 86400000) : '?';
    results.push({
      from:     get('From'),
      subject:  get('Subject'),
      date:     dateStr,
      daysAgo,
      snippet:  msg.data.snippet || '',
    });
  }
  // Sort oldest first
  results.sort((a, b) => new Date(a.date) - new Date(b.date));
  return results;
}

// ── Calendar ───────────────────────────────────────────────────────────────────

export async function getCalendarEvents(accessToken, refreshToken) {
  const auth     = getOAuthClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(now);
  tomorrowEnd.setDate(now.getDate() + 2);
  tomorrowEnd.setHours(0, 0, 0, 0);

  const res = await calendar.events.list({
    calendarId:   'primary',
    timeMin:      todayStart.toISOString(),
    timeMax:      tomorrowEnd.toISOString(),
    singleEvents: true,
    orderBy:      'startTime',
    timeZone:     'America/New_York',
  });

  return (res.data.items || []).map(e => ({
    id:          e.id,
    title:       e.summary || '',
    start:       e.start?.dateTime || e.start?.date || '',
    end:         e.end?.dateTime   || e.end?.date   || '',
    location:    e.location || '',
    description: e.description || '',
  }));
}

export async function getTodayEvents(accessToken, refreshToken) {
  const auth     = getOAuthClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const res = await calendar.events.list({
    calendarId:   'primary',
    timeMin:      start.toISOString(),
    timeMax:      end.toISOString(),
    singleEvents: true,
    orderBy:      'startTime',
    timeZone:     'America/New_York',
  });

  return (res.data.items || []).map(e => ({
    id:       e.id,
    title:    e.summary || '',
    start:    e.start?.dateTime || e.start?.date || '',
    end:      e.end?.dateTime   || e.end?.date   || '',
    location: e.location || '',
    description: e.description || '',
  }));
}

export async function getTomorrowEvents(accessToken, refreshToken) {
  const auth     = getOAuthClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tStart = new Date(tomorrow);
  tStart.setHours(0, 0, 0, 0);
  const tEnd = new Date(tomorrow);
  tEnd.setHours(23, 59, 59, 999);

  const res = await calendar.events.list({
    calendarId:   'primary',
    timeMin:      tStart.toISOString(),
    timeMax:      tEnd.toISOString(),
    singleEvents: true,
    orderBy:      'startTime',
    timeZone:     'America/New_York',
  });

  return (res.data.items || []).map(e => ({
    id:       e.id,
    title:    e.summary || '',
    start:    e.start?.dateTime || e.start?.date || '',
    end:      e.end?.dateTime   || e.end?.date   || '',
    location: e.location || '',
    description: e.description || '',
  }));
}
