'use client';

import ResultsDashboard from '@/components/ResultsDashboard';

function buildAiScores(scoring, isMentioned) {
  if (!scoring) {
    const base = isMentioned ? 38 : 20;
    return { chatgpt: base + 5, claude: base, perplexity: base + 3, gemini: base + 2 };
  }
  const clamp = (v, fb) => Math.min(Math.max(Math.round(v ?? fb), 0), 100);
  return {
    claude:     clamp(scoring.claudeScore, 20),
    chatgpt:    clamp(scoring.platformEstimates?.chatgpt, 20),
    perplexity: clamp(scoring.platformEstimates?.perplexity, 20),
    gemini:     clamp(scoring.platformEstimates?.gemini, 20),
  };
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
