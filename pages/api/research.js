export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { address, timeStr } = req.body;
  if (!address) return res.status(400).json({ error: 'address required' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
        messages:   [{
          role:    'user',
          content: `Pre-inspection research for Chris Simmons, Certified Residential Real Property Appraiser, Gainesville GA. North Metro Atlanta and North Georgia markets (Forsyth, Hall, Cherokee, Gwinnett, Fulton, DeKalb counties).

Search the web and find information about this property: ${address}

Return ONE JSON object. Use "N/A" for any field you cannot find. Do not guess.

{
  "address": "${address}",
  "inspectionTime": "${timeStr || 'TBD'}",
  "county": "county name",
  "subdivision": "subdivision or neighborhood name or N/A",
  "propertyType": "Single Family Residential or other type",
  "beds": "number or N/A",
  "baths": "number or N/A",
  "gla": "above-grade square feet or N/A",
  "yearBuilt": "4-digit year or N/A",
  "lotSize": "acres or sq ft or N/A",
  "lastSaleDate": "Month YYYY or N/A",
  "lastSalePrice": "$XXX,XXX or N/A",
  "estimatedValue": "$XXX,XXX or N/A",
  "estimatedTaxes": "$X,XXX/yr or N/A",
  "listingStatus": "Active or Pending or Off-Market or N/A",
  "listPrice": "$XXX,XXX or N/A",
  "dom": "days on market number or N/A",
  "marketContext": "2-3 sentences describing neighborhood character, typical price range, and current market conditions in this submarket",
  "flags": ["list of appraiser flags such as: off-market sale, flip pattern, flood zone exposure, FHA indicators, prior appraisal history, atypical characteristics — empty array if none"],
  "pullManually": ["specific data items not found online that need manual lookup via qPublic, FMLS, or Schneidercorp"]
}

Return ONLY the JSON object. No markdown fences, no explanation, no preamble.`,
        }],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text   = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    let   parsed = null;
    try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch {}

    if (!parsed) return res.status(500).json({ error: 'Parse failed', raw: text.slice(0, 300) });
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Research error for', address, err.message);
    return res.status(500).json({ error: err.message });
  }
}
