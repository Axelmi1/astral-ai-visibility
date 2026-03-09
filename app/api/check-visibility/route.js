import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 529 && i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      continue;
    }
    return res;
  }
}

// ── Save report to disk ──────────────────────────────────────────────────────
async function saveReport(id, data) {
  try {
    const dir = path.join(process.cwd(), 'data', 'reports');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${id}.json`), JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save report:', e);
  }
}

// ── Send notification (Slack or Telegram) ────────────────────────────────────
async function sendNotification({ projectName, url, score, mentionStrength, reportId }) {
  const reportUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://visibility.astral3.io'}/report/${reportId}`;
  const emoji = score >= 70 ? '🟢' : score >= 40 ? '🟡' : '🔴';
  const msg = `${emoji} New scan: *${projectName}*\nURL: ${url}\nScore: ${score}/100 (${mentionStrength})\nReport: ${reportUrl}`;

  // Telegram
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChat) {
    try {
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text: msg, parse_mode: 'Markdown' }),
      });
    } catch (e) { console.error('Telegram notification failed:', e); }
  }

  // Slack
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg }),
      });
    } catch (e) { console.error('Slack notification failed:', e); }
  }
}

function callClaude(content, maxTokens = 400) {
  return fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });
}

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // ── STEP 0: Fetch website content for context ──────────────────────────
    let siteContent = '';
    try {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      const siteResponse = await fetch(normalizedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (siteResponse.ok) {
        const html = await siteResponse.text();
        siteContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 2000);
      }
    } catch {
      // Site fetch failed — continue without it
    }

    // ── STEP 1: Identify project name + category + queries ─────────────────
    const identifyResponse = await callClaude(`Given this crypto/Web3 project:
URL: "${url}"
${siteContent ? `\nWebsite content (extracted text):\n"${siteContent}"\n` : ''}
Based on the URL${siteContent ? ' and website content' : ''}, respond in this exact JSON format only, no other text:
{
  "name": "Project Name",
  "category": "specific category of what they actually do",
  "description": "one sentence description of what the project actually does and offers",
  "queries": [
    "hyper-specific query targeting the project's exact use case",
    "another angle but still very specific to what THIS project does",
    "a third query focusing on the project's unique differentiator"
  ]
}

CRITICAL RULES FOR QUERIES:
Your goal is to write the PERFECT query that, if the AI knows this project, would make it recommend it. The query must describe EXACTLY what the project does, phrased as a user need.

Think step by step:
1. What SPECIFIC problem does this project solve?
2. What would someone with THAT EXACT problem type into ChatGPT?
3. Include specific details: the chain, the mechanism, the audience, the niche.

EXAMPLES of the level of specificity expected:
- For a perpetuals DEX on Arbitrum: "Where can I trade crypto perpetual futures on-chain without using a centralized exchange like Binance?"
- For an LLMO agency for Web3: "How can my DeFi protocol get mentioned when people ask ChatGPT or Claude for crypto recommendations?"
- For a yield aggregator on Ethereum: "What's the best way to automatically optimize my DeFi yield across multiple Ethereum lending protocols?"

BAD (too generic): "What are the best DeFi tools?" / "best crypto trading platforms"
GOOD (hyper-targeted): "Where can I get undercollateralized crypto loans using my on-chain reputation score?"

The "category" must describe what the project ACTUALLY DOES specifically, not a broad sector.

Always return valid JSON, no markdown.`, 400);

    if (!identifyResponse.ok) {
      return NextResponse.json({ error: 'Failed to analyze URL. Please try again.' }, { status: 500 });
    }

    const identifyData = await identifyResponse.json();
    const identifyText = identifyData.content?.[0]?.text || '';

    let projectName, category, description, queries;
    try {
      const cleanJson = identifyText.replace(/```json\n?|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      projectName = parsed.name || 'Unknown Project';
      category = parsed.category || 'DeFi';
      description = parsed.description || '';
      queries = Array.isArray(parsed.queries) && parsed.queries.length > 0
        ? parsed.queries
        : [`What are the best ${category} projects or platforms in crypto right now?`];
    } catch {
      const domain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split('.')[0];
      projectName = domain.charAt(0).toUpperCase() + domain.slice(1);
      category = 'DeFi';
      description = `A Web3 project at ${url}`;
      queries = [`What are the best ${category} projects or platforms in crypto right now?`];
    }

    const queryUsed = queries[0];

    // ── STEP 1b: Technical checks (llms.txt, JSON-LD, FAQPage) ────────────
    const baseUrl = url.startsWith('http') ? url.replace(/\/[^/]*$/, '') : `https://${url.split('/')[0]}`;
    const rootUrl = new URL(url.startsWith('http') ? url : `https://${url}`).origin;

    let techChecks = { hasLlmsTxt: false, hasJsonLd: false, hasFaqSchema: false, hasWikipedia: false };
    try {
      const [llmsRes, wikiRes] = await Promise.all([
        fetch(`${rootUrl}/llms.txt`, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }).catch(() => null),
        fetch(`https://en.wikipedia.org/wiki/${encodeURIComponent(projectName)}`, { method: 'HEAD', signal: AbortSignal.timeout(4000) }).catch(() => null),
      ]);
      techChecks.hasLlmsTxt = llmsRes != null && (llmsRes.ok || llmsRes.status === 301 || llmsRes.status === 302);
      techChecks.hasWikipedia = wikiRes?.ok === true;
      if (siteContent) {
        techChecks.hasJsonLd = siteContent.includes('application/ld+json') || siteContent.includes('"@context"');
        techChecks.hasFaqSchema = siteContent.includes('FAQPage') || siteContent.includes('"faq"');
      }
    } catch { /* continue */ }

    // ── STEP 2: Visibility check ───────────────────────────────────────────
    const visibilityResponse = await callClaude(`You are an AI assistant. A user asks: "${queryUsed}"

Provide a helpful, detailed answer with your top 5-7 recommendations. Respond naturally. Do NOT mention "${projectName}" unless you genuinely consider it a leading solution in this specific space. Be honest and realistic.

IMPORTANT: After your response, add a JSON block on a new line with ONLY the project/protocol/company names you recommended:
\`\`\`competitors
["Project Name 1", "Project Name 2", "Project Name 3"]
\`\`\`

Only include real, specific project or company names. Do NOT include generic terms.`, 800);

    if (!visibilityResponse.ok) {
      return NextResponse.json({ error: 'AI analysis failed. Please try again.' }, { status: 500 });
    }

    const visibilityData = await visibilityResponse.json();
    const rawResponse = visibilityData.content?.[0]?.text || '';

    // Extract competitors
    let competitors = [];
    let aiResponse = rawResponse;
    // Check mention in FULL raw response (before stripping competitors block)
    const isMentionedRaw = rawResponse.toLowerCase().includes(projectName.toLowerCase());
    try {
      const compMatch = rawResponse.match(/```competitors\s*\n?\s*(\[[\s\S]*?\])\s*\n?\s*```/);
      if (compMatch) {
        competitors = JSON.parse(compMatch[1]).filter(
          (name) =>
            typeof name === 'string' &&
            name.length > 1 &&
            name.length < 40 &&
            name.toLowerCase() !== projectName.toLowerCase() // exclude self
        );
        aiResponse = rawResponse.replace(/```competitors[\s\S]*?```/, '').trim();
      }
    } catch {
      // continue without competitors
    }

    // True if project name appears in competitors array (AI recommended it by name)
    const isInCompetitorsList = competitors.some(
      (c) => c.toLowerCase() === projectName.toLowerCase()
    ) || isMentionedRaw;

    // ── STEP 3a: Scores + mention ─────────────────────────────────────────
    const scorePrompt = `Analyze AI visibility for: "${projectName}" (${category}).

Query tested: "${queryUsed}"
First 800 chars of AI response: "${aiResponse.slice(0, 800)}"
Project name found in response: ${isMentionedRaw}
Project explicitly recommended: ${isInCompetitorsList}
Competitors shown instead: ${competitors.slice(0, 6).join(', ') || 'none'}
${siteContent ? `Site signals: "${siteContent.slice(0, 300)}"` : ''}

Reply with ONLY this JSON (no markdown):
{
  "claudeScore": <0-100>,
  "mentionStrength": <"invisible"|"weak"|"moderate"|"strong">,
  "chatgpt": <0-100>,
  "perplexity": <0-100>,
  "gemini": <0-100>,
  "gapSummary": "<1 sentence: main reason for poor AI visibility>"
}

Rules for claudeScore:
- mentioned=true OR recommended=true → score ≥ 35 (likely 40-70)
- top 3 competitor shown → score 20-40
- not mentioned at all → score 5-20
- clearly THE recommended solution → score 70-90

Rules for platform estimates (chatgpt/perplexity/gemini):
Base on brand size: major exchange/protocol (Kraken/Coinbase/Uniswap level) → 55-75. Mid-tier known project → 30-55. New seed-stage → 8-25.
Make the 3 platform scores DIFFERENT from each other by ±5-15 points reflecting each platform's training data.`;

    // ── STEP 3b: Personalized audit actions (separate call) ────────────────
    const actionsPrompt = `You are a GEO/LLMO technical auditor. Write 4 audit findings for "${projectName}" (${category}).

Context:
- URL: ${url}
- Competitors ranking above them on AI queries: ${competitors.slice(0, 4).join(', ') || 'Coinbase, Binance, competitors'}
- Category: ${category}

IMPORTANT: Use "${projectName}" by name in every description. Be specific to this exact project.

Return ONLY a valid JSON array — no explanation, no markdown fences:
[{"title":"Critical — [Issue]","desc":"[Specific to ${projectName}]","tags":["tag"]},{"title":"Critical — [Issue]","desc":"[Specific to ${projectName}]","tags":["tag"]},{"title":"High — [Issue]","desc":"[Specific to ${projectName}]","tags":["tag"]},{"title":"Medium — [Issue]","desc":"[Specific to ${projectName}]","tags":["tag"]}]

CONFIRMED technical status for ${projectName} (from live checks — DO NOT contradict these facts):
- /llms.txt: ${techChecks.hasLlmsTxt ? '✅ EXISTS — do NOT flag this as missing' : '❌ MISSING — flag as Critical'}
- JSON-LD schema: ${techChecks.hasJsonLd ? '✅ EXISTS — do NOT flag as missing' : '❌ MISSING — flag as Critical'}
- FAQPage schema: ${techChecks.hasFaqSchema ? '✅ EXISTS' : '❌ MISSING — flag as High'}
- Wikipedia/Wikidata: ${techChecks.hasWikipedia ? '✅ EXISTS' : '❌ MISSING — flag as Medium'}

Choose findings from this list ONLY for confirmed missing items above, plus additional relevant gaps:
- ❌ /llms.txt missing → "Critical — No /llms.txt: AI crawlers have no guidance file for ${projectName}"
- ❌ JSON-LD missing → "Critical — No structured schema: ${projectName} has no Organization/SoftwareApplication/FinancialService JSON-LD"
- ❌ FAQPage missing → "High — No FAQPage schema: AI cannot synthesize Q&A answers about ${projectName}"
- ❌ Wikipedia missing → "Medium — No entity disambiguation: ${projectName} has no Wikipedia or Wikidata entry"
- Always add 1 finding about: non-semantic headers (marketing copy vs question-based H2s) OR absent from key publications (The Block, Messari, Blockworks) — these are ALWAYS relevant`;

    // Fire both calls in parallel
    const [scoreRes, actionsRes] = await Promise.all([
      callClaude(scorePrompt, 300),
      callClaude(actionsPrompt, 700),
    ]);

    let scoring = null;
    if (scoreRes?.ok) {
      const d = await scoreRes.json();
      const t = d.content?.[0]?.text || '';
      try {
        const j = JSON.parse(t.replace(/```json\n?|```/g, '').trim());
        const visibilityScore = Math.round(
          (j.claudeScore ?? 15) * 0.4 +
          (j.chatgpt ?? 20)     * 0.2 +
          (j.perplexity ?? 20)  * 0.2 +
          (j.gemini ?? 20)      * 0.2
        );
        scoring = {
          visibilityScore,
          claudeScore: j.claudeScore,
          mentionStrength: j.mentionStrength,
          platformEstimates: { chatgpt: j.chatgpt, perplexity: j.perplexity, gemini: j.gemini },
          gapSummary: j.gapSummary,
          customActions: null, // filled below
        };
      } catch { /* use client fallback */ }
    }

    if (actionsRes?.ok) {
      const d = await actionsRes.json();
      const t = d.content?.[0]?.text || '';
      try {
        // Try multiple extraction strategies
        let arr = null;
        const clean = t.replace(/```json\n?|```\n?/g, '').trim();

        // Strategy 1: direct parse
        try { arr = JSON.parse(clean); } catch { /* try next */ }

        // Strategy 2: extract first [...] block
        if (!Array.isArray(arr)) {
          const match = clean.match(/\[[\s\S]*\]/);
          if (match) try { arr = JSON.parse(match[0]); } catch { /* try next */ }
        }

        // Strategy 3: extract from object wrapper e.g. {"customActions": [...]}
        if (!Array.isArray(arr) && typeof arr === 'object' && arr !== null) {
          const vals = Object.values(arr);
          arr = vals.find(Array.isArray) || null;
        }

        if (Array.isArray(arr) && arr.length >= 2 && scoring) {
          // Filter valid items
          const valid = arr.filter(
            (a) => a && typeof a.title === 'string' && typeof a.desc === 'string'
          );
          if (valid.length >= 2) scoring.customActions = valid;
        }
      } catch { /* keep null */ }
    }

    // ── Save report + notify ──────────────────────────────────────────────
    const reportId = randomUUID().split('-')[0]; // short 8-char ID
    const responseData = {
      aiResponse,
      projectName,
      category,
      description,
      url,
      queries,
      queryUsed,
      competitors,
      scoring,
      reportId,
      createdAt: new Date().toISOString(),
    };

    // Fire and forget — don't block the response
    saveReport(reportId, responseData);
    sendNotification({
      projectName,
      url,
      score: scoring?.visibilityScore ?? 0,
      mentionStrength: scoring?.mentionStrength ?? 'unknown',
      reportId,
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
