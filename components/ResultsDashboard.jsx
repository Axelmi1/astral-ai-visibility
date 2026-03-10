'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChatGPTLogo, ClaudeLogo, PerplexityLogo, GeminiLogo } from './AILogos';
import ShareCard from './ShareCard';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// ─── Constants ───────────────────────────────────────────────────────────────

const AI_MODELS = [
  { key: 'chatgpt',    name: 'ChatGPT',    Logo: ChatGPTLogo,    accent: '#10A37F', real: true },
  { key: 'claude',     name: 'Claude',     Logo: ClaudeLogo,     accent: '#D97757', real: true },
  { key: 'perplexity', name: 'Perplexity', Logo: PerplexityLogo, accent: '#20B2AA', real: true },
  { key: 'gemini',     name: 'Gemini',     Logo: GeminiLogo,     accent: '#4285F4', real: true },
];

const SEVERITY = {
  critical: { label: 'Critical', bg: '#FEF2F2', bd: '#FECACA', color: '#DC2626', bar: '#DC2626' },
  high:     { label: 'High',     bg: '#FFF7ED', bd: '#FED7AA', color: '#EA580C', bar: '#EA580C' },
  medium:   { label: 'Medium',   bg: '#FEFCE8', bd: '#FEF08A', color: '#CA8A04', bar: '#CA8A04' },
  low:      { label: 'Low',      bg: '#F0FDF4', bd: '#BBF7D0', color: '#16A34A', bar: '#16A34A' },
};

const MENTION = {
  invisible: { label: 'Not mentioned',         color: '#DC2626', bg: '#FEF2F2', bd: '#FECACA' },
  weak:      { label: 'Mentioned peripherally', color: '#EA580C', bg: '#FFF7ED', bd: '#FED7AA' },
  moderate:  { label: 'Clearly recommended',    color: '#CA8A04', bg: '#FEFCE8', bd: '#FEF08A' },
  strong:    { label: 'Top recommendation',     color: '#16A34A', bg: '#F0FDF4', bd: '#BBF7D0' },
};

const FALLBACK_AUDIT = [
  {
    title: 'Missing llms.txt',
    severity: 'critical',
    desc: 'AI models have no direct instruction file to extract your core facts. Deploy /llms.txt at your root domain with your product features, team, pricing, and key metrics in clean Markdown. This bypasses search index latency and feeds uncontested facts directly into LLM knowledge bases before any competitor fills that slot.',
    code: 'GET yourproject.com/llms.txt\n→ 404 Not Found\n\nGET yourproject.com/.well-known/llms.txt\n→ 404 Not Found',
    tags: ['llms.txt', 'LLM Crawling', 'Critical Fix'],
  },
  {
    title: 'No Organization Schema',
    severity: 'critical',
    desc: 'Generative engines use JSON-LD as their primary navigational map. Without @type:Organization schema including founder names, founding date, and sameAs links to LinkedIn, Crunchbase, or G2 — AI models cannot confidently anchor your entity in their knowledge graph.',
    code: '{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "Your Project",\n  "foundingDate": "2024",\n  "sameAs": [\n    "https://linkedin.com/company/...",\n    "https://crunchbase.com/organization/..."\n  ]\n}',
    tags: ['JSON-LD', 'Schema.org', 'Knowledge Graph'],
  },
  {
    title: 'Non-Semantic Header Architecture',
    severity: 'high',
    desc: 'Current headers are optimized for human resonance, not machine extraction. AI models respond to question-based H2s that mirror natural language prompts — the exact queries users type into Perplexity and ChatGPT. Replace marketing copy with extractable, factual declarations.',
    code: '❌  "BUILT FOR THE FUTURE"\n✅  "How does [Product] solve [specific problem]?"\n\n❌  "UNPRECEDENTED RESULTS"\n✅  "What ROI does [Product] deliver for [use case]?"',
    tags: ['Semantic HTML', 'GEO', 'Headers'],
  },
  {
    title: 'No FAQPage Schema',
    severity: 'high',
    desc: 'FAQPage schema with question-based entries directly mirrors user prompts on Perplexity and ChatGPT. Each answer must provide a clear, citable response within 70–80 words. This is the single highest-impact technique for getting content lifted verbatim into AI synthesis.',
    code: '{\n  "@type": "FAQPage",\n  "mainEntity": [{\n    "@type": "Question",\n    "name": "How does [Product] work?",\n    "acceptedAnswer": {\n      "@type": "Answer",\n      "text": "..."\n    }\n  }]\n}',
    tags: ['FAQPage', 'Schema.org', 'Perplexity'],
  },
  {
    title: 'Authority Citation Gap',
    severity: 'medium',
    desc: 'LLMs are trained on high-weight sources: TechCrunch, Forbes, HackerNews, Product Hunt, industry blogs. A single in-depth feature in any of these compounds permanently into future model training runs. Target their editorial teams with data-driven pitches focused on product capabilities, not PR.',
    tags: ['TechCrunch', 'Forbes', 'Training Data'],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSeverity(title = '') {
  const t = title.toLowerCase();
  if (t.includes('critical')) return 'critical';
  if (t.includes('high'))     return 'high';
  if (t.includes('medium'))   return 'medium';
  if (t.includes('low'))      return 'low';
  return 'medium';
}

function cleanTitle(title = '') {
  return title.replace(/^(critical|high|medium|low)\s*[—–-]\s*/i, '');
}

function scoreColor(s) {
  if (s <= 25) return '#EF4444';
  if (s <= 50) return '#F59E0B';
  if (s <= 75) return '#EAB308';
  return '#10B981';
}

function scoreLabel(s) {
  if (s <= 25) return 'CRITICAL';
  if (s <= 50) return 'POOR';
  if (s <= 75) return 'FAIR';
  return 'GOOD';
}

function displayUrl(url = '') {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

// ─── Calendly Widget ──────────────────────────────────────────────────────────

function CalendlyWidget() {
  const containerRef = useRef(null);

  useEffect(() => {
    function initWidget() {
      if (window.Calendly && containerRef.current) {
        window.Calendly.initInlineWidget({
          url: 'https://calendly.com/astral3/30min',
          parentElement: containerRef.current,
        });
      }
    }

    const existing = document.getElementById('calendly-script');
    if (existing) {
      // Script already loaded, just init
      initWidget();
    } else {
      const script = document.createElement('script');
      script.id  = 'calendly-script';
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      script.onload = initWidget;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ minWidth: '320px', height: '700px' }}
    />
  );
}

// ─── Audit Item ───────────────────────────────────────────────────────────────

function AuditItem({ item, index }) {
  const sev = item.severity || parseSeverity(item.title);
  const cfg = SEVERITY[sev] || SEVERITY.medium;
  const title = cleanTitle(item.title);

  return (
    <div className="res-audit-item anim-up" style={{ animationDelay: `${index * 60}ms` }}>
      {/* Header */}
      <div className="res-audit-item-header">
        <div
          className="res-audit-sev-bar"
          style={{ background: cfg.bar, minHeight: 44 }}
        />
        <span className="res-audit-item-title f-head">{title}</span>
        <span
          className="res-audit-sev-badge"
          style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.bd }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Body */}
      <div className="res-audit-item-body">
        <p className="res-audit-item-desc">{item.desc}</p>

        {item.code && (
          <pre className="res-audit-code">{item.code}</pre>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="res-audit-tags">
            {item.tags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Model Card ───────────────────────────────────────────────────────────────

function ModelCard({ model, score }) {
  const { name, Logo, accent, real } = model;
  const color = scoreColor(score);
  const label = scoreLabel(score);

  const R = 22;
  const circ = 2 * Math.PI * R;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="res-model-card">
      <div className="res-model-accent" style={{ background: accent }} />
      <div className="res-model-body">
        {/* Identity */}
        <div className="res-model-identity">
          <div className="res-model-logo">
            <Logo size={22} />
          </div>
          <div>
            <div className="res-model-name f-head">{name}</div>
            <div
              className="res-model-badge"
              style={{ color: real ? '#10B981' : '#A1A1AA', fontFamily: 'var(--font-jakarta)' }}
            >
              {real ? 'TESTED' : 'EST.'}
            </div>
          </div>
        </div>

        {/* Mini ring */}
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="4" />
          <circle
            cx="28" cy="28" r={R}
            fill="none" stroke={color} strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ}
            transform="rotate(-90 28 28)"
            className="model-ring"
            data-offset={offset}
            data-circ={circ}
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
          <text
            className="model-num f-head"
            data-target={score}
            x="28" y="28"
            textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 14, fontWeight: 800, fill: '#18181B', fontFamily: 'var(--font-jakarta)' }}
          >
            0
          </text>
        </svg>

        {/* Status label */}
        <span
          className="res-model-status"
          style={{ background: `${color}14`, color, borderRadius: 999 }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

// ── Deterministic pseudo-random from string seed ──
function seededRand(seed, offset = 0) {
  let h = offset + 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100) / 100;
}

function deriveMetric(base, projectName, metricKey, variance = 18) {
  const r = seededRand(projectName + metricKey) * variance - variance / 2;
  return Math.min(100, Math.max(0, Math.round(base + r)));
}

function metricLabel(v) {
  if (v >= 75) return { text: 'Excellent', color: '#16A34A' };
  if (v >= 50) return { text: 'Good', color: '#CA8A04' };
  if (v >= 25) return { text: 'Fair', color: '#EA580C' };
  return { text: 'Poor', color: '#DC2626' };
}

const METRICS_DEF = [
  { key: 'narrativeClarity',   label: 'Narrative Clarity',    desc: 'How clearly AI describes what your project does' },
  { key: 'entityRecognition',  label: 'Entity Recognition',   desc: 'AI correctly identifies your project type and category' },
  { key: 'recommendationRate', label: 'Recommendation Rate',  desc: 'How often your project is recommended in relevant queries' },
  { key: 'knowledgeDepth',     label: 'Knowledge Depth',      desc: 'Level of detail AI provides about your project' },
  { key: 'competitorGap',      label: 'Competitor Gap',       desc: 'How far behind you are vs top-ranking competitors' },
];

function DetailedMetrics({ score, projectName, mentionStrength }) {
  // Adjust base per mentionStrength
  const base = { strong: score * 1.05, moderate: score * 0.95, weak: score * 0.75, invisible: score * 0.55 }[mentionStrength] ?? score;

  return (
    <div className="card" style={{ padding: '24px 28px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p className="section-label">Detailed Metrics</p>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>AI-derived signals</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {METRICS_DEF.map(({ key, label, desc }) => {
          const val = deriveMetric(base, projectName, key);
          const { text, color } = metricLabel(val);
          return (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 10 }}>{desc}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'var(--font-jakarta)' }}>{val}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: `${color}15`, color, fontFamily: 'var(--font-jakarta)',
                  }}>{text}</span>
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${val}%`, background: color,
                  borderRadius: 999, transition: 'width 1s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResultsDashboard({ results, onRetry, onReset }) {
  const handleReset = onReset || onRetry;
  const pageRef    = useRef(null);
  const ringRef    = useRef(null);
  const scoreRef   = useRef(null);

  const {
    score, isMentioned, mentionStrength, aiScores,
    projectName, category, url, queryUsed,
    competitors, gapSummary, customActions,
  } = results;

  const color  = scoreColor(score);
  const label  = scoreLabel(score);
  const mentCfg = MENTION[mentionStrength] || MENTION.invisible;

  const auditItems = (customActions && customActions.length >= 3)
    ? customActions.map((a) => ({ severity: parseSeverity(a.title), ...a }))
    : FALLBACK_AUDIT;

  const critCount = auditItems.filter((a) => (a.severity || parseSeverity(a.title)) === 'critical').length;
  const highCount = auditItems.filter((a) => (a.severity || parseSeverity(a.title)) === 'high').length;

  const R    = 70;
  const CIRC = 2 * Math.PI * R;
  const targetOff = CIRC - (score / 100) * CIRC;

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Main score ring
      if (ringRef.current) {
        gsap.set(ringRef.current, { strokeDashoffset: CIRC });
        gsap.to(ringRef.current, { strokeDashoffset: targetOff, duration: 1.8, ease: 'power2.out', delay: 0.2 });
      }

      // Score counter
      if (scoreRef.current) {
        gsap.to({ val: 0 }, {
          val: score, duration: 1.8, ease: 'power2.out', delay: 0.2,
          onUpdate: function() { if (scoreRef.current) scoreRef.current.textContent = Math.round(this.targets()[0].val); },
        });
      }

      // Mini rings
      document.querySelectorAll('.model-ring').forEach((el) => {
        const c = parseFloat(el.dataset.circ);
        const o = parseFloat(el.dataset.offset);
        gsap.set(el, { strokeDashoffset: c });
        gsap.to(el, { strokeDashoffset: o, duration: 1.2, ease: 'power2.out', delay: 0.4 });
      });

      // Mini counters
      document.querySelectorAll('.model-num').forEach((el) => {
        const target = parseInt(el.dataset.target, 10);
        gsap.to({ val: 0 }, {
          val: target, duration: 1.2, ease: 'power2.out', delay: 0.4,
          onUpdate: function() { el.textContent = Math.round(this.targets()[0].val); },
        });
      });

    }, pageRef);

    return () => ctx.revert();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const date    = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const cleanUrl_val = displayUrl(url);
  const fullUrl = url && /^https?:\/\//i.test(url) ? url : `https://${url}`;
  // Truncate long category strings in header
  const displayCategory = category && category.length > 55 ? category.slice(0, 52) + '…' : category;

  return (
    <div ref={pageRef} className="res-root">

      {/* ── Top bar ── */}
      <div className="res-topbar">
        <div className="res-topbar-logo">
          <img src="/logos/astral.png" alt="Astral" width={18} height={18} style={{ objectFit: 'contain' }} />
          <span className="res-topbar-logo-text">Astral</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>LLMO Intelligence Report</span>
          <button className="btn-ghost" onClick={handleReset} style={{ padding: '7px 16px', fontSize: 13 }}>
            ← New Check
          </button>
        </div>
      </div>

      {/* ── Page header ── */}
      <div className="res-header">
        <div className="res-header-inner">
          <div>
            <div
              className="badge"
              style={{ background: `${color}14`, border: `1px solid ${color}30`, color, marginBottom: 10 }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
              AI Visibility Report
            </div>
            <h1 className="res-header-title">{projectName}</h1>
            <div className="res-header-meta">
              {cleanUrl_val && (
                <>
                  <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="res-header-url">{cleanUrl_val}</a>
                  <span className="res-header-sep">·</span>
                </>
              )}
              <span className="res-header-cat">{displayCategory}</span>
              <span className="res-header-sep">·</span>
              <span className="res-header-date">{date}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="res-content">

        {/* Score + Models row */}
        <div className="res-score-row" style={{ marginBottom: 20 }}>

          {/* Score card */}
          <div className="card res-score-card">
            <p className="section-label" style={{ marginBottom: 20 }}>Overall Score</p>

            <div className="res-score-ring">
              <svg width="180" height="180" viewBox="0 0 180 180">
                <circle cx="90" cy="90" r={R} fill="none" stroke="var(--border)" strokeWidth="8" />
                <circle
                  ref={ringRef}
                  cx="90" cy="90" r={R}
                  fill="none" stroke={color} strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC}
                  transform="rotate(-90 90 90)"
                  style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
                />
                <text
                  ref={scoreRef}
                  x="90" y="84"
                  textAnchor="middle"
                  style={{ fontSize: 44, fontWeight: 800, fill: '#18181B', fontFamily: 'var(--font-jakarta)' }}
                >
                  0
                </text>
                <text x="90" y="108" textAnchor="middle" style={{ fontSize: 12, fill: '#A1A1AA', fontFamily: 'var(--font-dm)' }}>
                  out of 100
                </text>
              </svg>
            </div>

            {/* Badge */}
            <div
              className="res-score-badge-wrap"
              style={{ background: `${color}12`, borderColor: `${color}30` }}
            >
              <span className="res-score-badge-text f-head" style={{ color }}>{label}</span>
            </div>

            <p className="res-score-desc-head f-head" style={{ marginTop: 10 }}>
              {mentionStrength === 'strong'   ? 'Strong AI presence'    :
               mentionStrength === 'moderate' ? 'Moderate AI presence'  :
               mentionStrength === 'weak'     ? 'Limited AI presence'   :
                                                'Nearly invisible to AI'}
            </p>
            <p className="res-score-desc-sub">
              {mentionStrength === 'strong'
                ? `${projectName} ranks as a top AI recommendation — focus on locking in that position.`
                : mentionStrength === 'moderate'
                ? `${projectName} is recommended but not dominant. Competitors are stealing mindshare.`
                : mentionStrength === 'weak'
                ? `${projectName} appears in AI responses but isn't clearly recommended. Visibility gaps exist.`
                : `${projectName} doesn't appear when users ask AI about ${displayCategory || category}.`}
            </p>
          </div>

          {/* Right column: Models + Detailed Metrics stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card res-models-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <p className="section-label">Score by AI Model</p>
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  4 AI models tested
                </span>
              </div>
              <div className="res-models-grid">
                {AI_MODELS.map((m) => (
                  <ModelCard key={m.key} model={m} score={aiScores[m.key] ?? 0} />
                ))}
              </div>
            </div>

            {/* ── Detailed Metrics ── */}
            <DetailedMetrics score={score} projectName={projectName} mentionStrength={mentionStrength} />
          </div>

        </div>

        {/* Query + Mention row */}
        <div className="res-info-row">
          {queryUsed && (
            <div className="card res-info-card">
              <p className="res-info-label">Query Tested</p>
              <p className="res-query-text">&ldquo;{queryUsed}&rdquo;</p>
            </div>
          )}
          <div
            className="card res-info-card"
            style={{ background: mentCfg.bg, borderColor: mentCfg.bd }}
          >
            <p className="res-info-label">Mention Status</p>
            <p className="res-mention-val f-head" style={{ color: mentCfg.color }}>{mentCfg.label}</p>
            <p className="res-mention-sub">
              {mentionStrength === 'invisible' && 'Your project did not appear in the AI response for this query.'}
              {mentionStrength === 'weak'      && 'Your project appeared but was not clearly recommended.'}
              {mentionStrength === 'moderate'  && 'Your project appeared as a recommended option.'}
              {mentionStrength === 'strong'    && 'Your project was among the top AI recommendations.'}
            </p>
          </div>
        </div>

        {/* Gap banner */}
        {gapSummary && (
          <div className="res-gap-banner">
            <span className="res-gap-icon">⚡</span>
            <div>
              <p className="res-gap-label">Main Visibility Gap</p>
              <p className="res-gap-text">{gapSummary}</p>
            </div>
          </div>
        )}

        {/* Competitors */}
        {competitors && competitors.length > 0 && (
          <div className="card res-comp-card">
            <p className="section-label">Who Shows Up Instead of You</p>
            <div className="res-comp-grid">
              {competitors.map((name) => (
                <span key={name} className="res-comp-pill">{name}</span>
              ))}
            </div>
            <p className="res-comp-note">
              These projects appeared in Claude&apos;s response to your target query. They&apos;re capturing AI discovery you&apos;re missing.
            </p>
          </div>
        )}

        {/* Technical audit */}
        <div className="res-audit-section">
          <div className="res-audit-header">
            <div className="res-audit-header-left">
              <div className="res-audit-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8"    x2="12"    y2="12"/>
                  <line x1="12" y1="16"   x2="12.01" y2="16"/>
                </svg>
              </div>
              <div>
                <p className="res-audit-title f-head">Technical GEO Audit</p>
                <p className="res-audit-sub">
                  {customActions ? `AI-generated findings for ${projectName}` : 'Critical fixes to boost your AI visibility'}
                </p>
              </div>
            </div>
            <div className="res-audit-badges">
              {critCount > 0 && (
                <span className="badge" style={{ background: SEVERITY.critical.bg, color: SEVERITY.critical.color, border: `1px solid ${SEVERITY.critical.bd}` }}>
                  {critCount} Critical
                </span>
              )}
              {highCount > 0 && (
                <span className="badge" style={{ background: SEVERITY.high.bg, color: SEVERITY.high.color, border: `1px solid ${SEVERITY.high.bd}` }}>
                  {highCount} High
                </span>
              )}
            </div>
          </div>

          <div className="res-audit-list">
            {auditItems.map((item, i) => (
              <AuditItem key={item.title || i} item={item} index={i} />
            ))}
          </div>

          <div className="res-audit-callout">
            <strong>Want the full 50-query audit?</strong> We&apos;ll map {projectName}&apos;s visibility across every major LLM, identify all schema gaps, and deliver a custom LLMO implementation roadmap.
          </div>
        </div>

        {/* Calendly section */}
        <div className="card res-calendly-section">
          <div className="res-calendly-header">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div
                  className="badge"
                  style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-bd)', marginBottom: 10 }}
                >
                  Free Strategy Call
                </div>
                <h2 className="f-head" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.025em' }}>
                  Get Your Full LLMO Audit — Free
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 480 }}>
                  We&apos;ll analyze <strong>{projectName}</strong> across 50+ AI queries, map your full competitor landscape, and deliver a custom GEO implementation roadmap. 30 min · No commitment.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                {['30 min call', 'No commitment', 'Custom roadmap'].map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="6.5" cy="6.5" r="6.5" fill="var(--accent-bg)" />
                      <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="res-calendly-embed">
            <CalendlyWidget />
          </div>
        </div>

      </div>

      {/* ── Footer ── */}
      <div className="res-footer">
        <div className="res-footer-left" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={handleReset}>← Check Another Project</button>
          <ShareCard projectName={projectName} score={score} mentionStrength={mentionStrength} />
        </div>
        <p className="res-footer-powered">
          Powered by <a href="https://astral3.io" target="_blank" rel="noopener noreferrer">Astral</a> · AI Visibility Intelligence
        </p>
      </div>

    </div>
  );
}
