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
    let metaInfo = '';
    try {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      const siteResponse = await fetch(normalizedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      });
      // Read HTML even on non-200 (403 Cloudflare pages still have HTML)
      {
        const html = await siteResponse.text();

        // Extract meta tags first (always present even in SPAs)
        const metaTags = [];
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch) metaTags.push(`Title: ${titleMatch[1].trim()}`);
        const metaRegex = /<meta[^>]*(?:name|property)=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*/gi;
        let m;
        while ((m = metaRegex.exec(html)) !== null) {
          const key = m[1].toLowerCase();
          if (['description', 'og:description', 'og:title', 'twitter:description', 'twitter:title', 'keywords'].includes(key)) {
            metaTags.push(`${m[1]}: ${m[2]}`);
          }
        }
        // Also try reverse attribute order: content before name
        const metaRegex2 = /<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']([^"']+)["'][^>]*/gi;
        while ((m = metaRegex2.exec(html)) !== null) {
          const key = m[2].toLowerCase();
          if (['description', 'og:description', 'og:title', 'twitter:description', 'twitter:title', 'keywords'].includes(key)) {
            metaTags.push(`${m[2]}: ${m[1]}`);
          }
        }
        metaInfo = metaTags.join('\n');

        // Detect Cloudflare challenge / anti-bot pages (no useful content)
        const isBlocked = (html.includes('Just a moment') && html.includes('cf_chl'))
          || html.includes('challenge-platform')
          || html.includes('Enable JavaScript and cookies to continue');

        if (isBlocked) {
          metaInfo = ''; // Cloudflare meta tags are useless
        }

        if (!isBlocked) {
          siteContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 2000);
        }
        // If blocked, siteContent stays empty — Claude will use its own knowledge
      }
    } catch {
      // Site fetch failed — continue without it
    }

    // ── STEP 0b: Fallback — fetch cached version if site is blocked ────────
    let webContext = '';
    if (!siteContent && !metaInfo) {
      const domain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      try {
        // Step 1: Get exact archive URL via Wayback API (fast)
        const wbApi = await fetch(
          `https://archive.org/wayback/available?url=${encodeURIComponent(domain)}`,
          { signal: AbortSignal.timeout(4000) }
        ).catch(() => null);
        let archiveUrl = null;
        if (wbApi?.ok) {
          const wb = await wbApi.json();
          archiveUrl = wb?.archived_snapshots?.closest?.url || null;
        }

        // Step 2: Fetch the archived page
        if (archiveUrl) {
          const archiveRes = await fetch(archiveUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(8000),
          }).catch(() => null);
          if (archiveRes?.ok) {
            const archiveHtml = await archiveRes.text();
            const archiveMeta = [];
            const titleMatch = archiveHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (titleMatch) {
              const t = titleMatch[1].replace(/\s+/g, ' ').trim();
              if (t && !t.includes('Just a moment')) archiveMeta.push(`Title: ${t}`);
            }
            // Extract all meta tags — handle both attribute orders
            const allMetas = archiveHtml.match(/<meta[^>]*>/gi) || [];
            for (const tag of allMetas) {
              const nameMatch = tag.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i);
              const contentMatch = tag.match(/content\s*=\s*["']([^"']+)["']/i);
              if (nameMatch && contentMatch) {
                const key = nameMatch[1].toLowerCase();
                if (['description', 'og:description', 'og:title', 'twitter:description', 'twitter:title'].includes(key)) {
                  archiveMeta.push(`${nameMatch[1]}: ${contentMatch[1]}`);
                }
              }
            }
            if (archiveMeta.length > 0) {
              webContext = `Cached info from web archive:\n${archiveMeta.join('\n')}`.slice(0, 1000);
            }
          }
        }
      } catch { /* continue without web context */ }
    }

    // ── STEP 1: Identify project name + category + queries ─────────────────
    const hasContext = siteContent || metaInfo || webContext;
    const identifyResponse = await callClaude(`Given this project/business:
URL: "${url}"
${metaInfo ? `\nMeta tags from the website:\n${metaInfo}\n` : ''}
${siteContent ? `\nWebsite content (extracted text):\n"${siteContent}"\n` : ''}
${webContext ? `\nInformation found on the web about this project:\n${webContext}\n` : ''}
Based on the URL${hasContext ? ' and available context' : ''}, respond in this exact JSON format only, no other text:
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
3. Include specific details: the industry, the mechanism, the audience, the niche.

EXAMPLES of the level of specificity expected:
- For a project management tool: "What's the best project management software for remote engineering teams with Jira-like features but simpler?"
- For an AI writing assistant: "What tools can help me write SEO-optimized blog posts using AI without sounding robotic?"
- For a CRM for startups: "What's the best lightweight CRM for early-stage B2B SaaS startups that integrates with Slack?"

BAD (too generic): "What are the best SaaS tools?" / "best software platforms"
GOOD (hyper-targeted): "What's the best tool for automating customer onboarding emails for SaaS companies?"

The "category" must describe what the project ACTUALLY DOES specifically, not a broad sector.

IMPORTANT: If NO website content or meta tags are provided above, the site is likely behind Cloudflare protection or is a SPA. In this case you MUST use YOUR OWN KNOWLEDGE of this project/brand to identify it. Think: "Do I know what ${url} is? What does this company actually do?" Do NOT guess generic categories from the domain name alone — if you know the brand, describe what it ACTUALLY does. If you truly don't know it, say so honestly in the description.

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
      category = parsed.category || 'Software';
      description = parsed.description || '';
      queries = Array.isArray(parsed.queries) && parsed.queries.length > 0
        ? parsed.queries
        : [`What are the best ${category} tools or platforms right now?`];
    } catch {
      const domain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split('.')[0];
      projectName = domain.charAt(0).toUpperCase() + domain.slice(1);
      category = 'Software';
      description = `A project at ${url}`;
      queries = [`What are the best ${category} tools or platforms right now?`];
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

    // ── STEP 1c: Brand recognition check ───────────────────────────────────
    let brandRecognition = 'unknown'; // unknown | emerging | established | major
    try {
      const brandRes = await callClaude(`Rate the brand recognition of "${projectName}" (${category}, URL: ${url}).

Reply with ONLY one of these exact words, nothing else:
- "major" = household name or industry leader (e.g. Google, Stripe, Shopify, GitHub, Coinbase, Nike)
- "established" = well-known in its industry, significant user base (e.g. Notion, Vercel, Kraken, Ahrefs)
- "emerging" = growing brand, some recognition in niche (e.g. Linear, Cursor, Render)
- "unknown" = new or very niche, almost no public recognition

Reply with ONE word only.`, 10);
      if (brandRes?.ok) {
        const bt = (await brandRes.json()).content?.[0]?.text?.trim().toLowerCase() || '';
        if (['major', 'established', 'emerging', 'unknown'].includes(bt)) brandRecognition = bt;
      }
    } catch { /* continue with unknown */ }

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
Brand recognition level: ${brandRecognition}
Has Wikipedia page: ${techChecks.hasWikipedia}

Reply with ONLY this JSON (no markdown):
{
  "claudeScore": <0-100>,
  "mentionStrength": <"invisible"|"weak"|"moderate"|"strong">,
  "chatgpt": <0-100>,
  "perplexity": <0-100>,
  "gemini": <0-100>,
  "gapSummary": "<1 sentence: main reason for poor AI visibility or area to improve>"
}

IMPORTANT — Score based on REAL-WORLD brand recognition, not just this one query:

Step 1: Assess brand recognition independently.
- Is this a well-known, established company in its industry? (e.g. Kraken, Shopify, HubSpot, Stripe)
- Does it have significant market presence, press coverage, Wikipedia page, large user base?
- A major established brand should NEVER score below 40, even if not mentioned in this specific query.

Step 2: Factor in the query result.
- mentioned=true AND clearly the top recommendation → 75-95
- mentioned=true OR recommended=true → 50-75
- NOT mentioned but well-known major brand → 40-60 (the query may just be too narrow)
- NOT mentioned and mid-tier known brand → 25-45
- NOT mentioned and unknown/new project → 5-25

Rules for mentionStrength:
- "strong": mentioned as a top recommendation
- "moderate": mentioned but not first choice, OR not mentioned but major well-known brand
- "weak": not mentioned, mid-tier brand with some recognition
- "invisible": not mentioned and genuinely unknown/new project

Rules for platform estimates (chatgpt/perplexity/gemini):
Base on brand size: major established brand → 55-80. Mid-tier known project → 30-55. New early-stage → 8-25.
Make the 3 platform scores DIFFERENT from each other by ±5-15 points reflecting each platform's training data.

CRITICAL: Do NOT give a score of 5-20 to a company that is clearly well-known in its industry. Use your knowledge of the brand to score fairly.`;

    // ── STEP 3b: Personalized audit actions (separate call) ────────────────
    const actionsPrompt = `You are a GEO/LLMO technical auditor. Write 4 audit findings for "${projectName}" (${category}).

Context:
- URL: ${url}
- Competitors ranking above them on AI queries: ${competitors.slice(0, 4).join(', ') || 'top competitors in their space'}
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
        // Apply brand recognition floor — Claude's scores are too conservative for known brands
        const floors = { major: 55, established: 40, emerging: 25, unknown: 0 };
        const floor = floors[brandRecognition] ?? 0;
        const applyFloor = (v) => Math.max(v ?? 0, floor);

        const adjustedClaude = applyFloor(j.claudeScore);
        const adjustedChatgpt = applyFloor(j.chatgpt);
        const adjustedPerplexity = applyFloor(j.perplexity);
        const adjustedGemini = applyFloor(j.gemini);

        const adjustedVisibility = Math.round(
          adjustedClaude * 0.4 + adjustedChatgpt * 0.2 + adjustedPerplexity * 0.2 + adjustedGemini * 0.2
        );

        // Fix mentionStrength for known brands
        let adjustedMention = j.mentionStrength;
        if (brandRecognition === 'major' && adjustedMention === 'invisible') adjustedMention = 'moderate';
        if (brandRecognition === 'established' && adjustedMention === 'invisible') adjustedMention = 'weak';

        scoring = {
          visibilityScore: adjustedVisibility,
          claudeScore: adjustedClaude,
          mentionStrength: adjustedMention,
          platformEstimates: { chatgpt: adjustedChatgpt, perplexity: adjustedPerplexity, gemini: adjustedGemini },
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
