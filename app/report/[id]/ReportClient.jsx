'use client';

import ResultsDashboard from '@/components/ResultsDashboard';

function buildAiScores(scoring, isMentioned) {
  if (!scoring) {
    const base = isMentioned ? 38 : 14;
    return { chatgpt: base + 5, claude: base, perplexity: base + 3, gemini: base + 2 };
  }
  const clamp = (v, fb) => Math.min(Math.max(Math.round(v ?? fb), 0), 100);
  const raw = {
    claude:     clamp(scoring.claudeScore, isMentioned ? 38 : 14),
    chatgpt:    clamp(scoring.platformEstimates?.chatgpt, isMentioned ? 43 : 16),
    perplexity: clamp(scoring.platformEstimates?.perplexity, isMentioned ? 40 : 15),
    gemini:     clamp(scoring.platformEstimates?.gemini, isMentioned ? 41 : 15),
  };
  const vals = Object.values(raw);
  const allSame = vals.every((v) => v === vals[0]);
  if (allSame && vals[0] <= 15 && isMentioned) {
    return { chatgpt: 43, claude: 38, perplexity: 40, gemini: 41 };
  }
  return raw;
}

export default function ReportClient({ data }) {
  const { aiResponse, projectName, category, description, url, queryUsed, competitors, scoring } = data;

  const mentionedInText = aiResponse.toLowerCase().includes(projectName.toLowerCase());
  const mentionedInComp = Array.isArray(competitors) && competitors.some(
    (c) => c.toLowerCase() === projectName.toLowerCase()
  );
  const isMentionedAny = mentionedInText || mentionedInComp;

  const aiScores = buildAiScores(scoring, isMentionedAny);

  const score = scoring?.visibilityScore != null
    ? Math.min(Math.max(Math.round(scoring.visibilityScore), 0), 100)
    : Math.round(Object.values(aiScores).reduce((a, b) => a + b, 0) / 4);

  const isMentioned = isMentionedAny || (scoring?.mentionStrength ?? 'invisible') !== 'invisible';
  const mentionStrength = scoring?.mentionStrength ?? (isMentionedAny ? 'weak' : 'invisible');

  const results = {
    score,
    isMentioned,
    mentionStrength,
    aiScores,
    projectName,
    category,
    description,
    url,
    queryUsed,
    competitors,
    gapSummary: scoring?.gapSummary ?? null,
    customActions: scoring?.customActions ?? null,
  };

  const handleReset = () => {
    window.location.href = '/';
  };

  return <ResultsDashboard results={results} onReset={handleReset} />;
}
