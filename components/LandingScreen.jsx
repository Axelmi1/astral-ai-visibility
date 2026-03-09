'use client';

function FieldError({ children }) {
  return <p className="land-field-error">{children}</p>;
}

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <circle cx="6.5" cy="6.5" r="6.5" fill="rgba(124,58,237,0.25)" />
    <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function LandingScreen({ fields, setFields, errors, onSubmit }) {
  const { url } = fields;

  const setUrl = (e) => setFields((prev) => ({ ...prev, url: e.target.value }));
  const handleKeyDown = (e) => { if (e.key === 'Enter') onSubmit(); };

  return (
    <div className="land-root">
      {/* Nav */}
      <nav className="land-nav anim-up d-0">
        <div className="land-logo">
          <div className="land-logo-mark">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4.5V10.5L7 14L1 10.5V4.5L7 1Z" fill="rgba(255,255,255,0.9)" />
            </svg>
          </div>
          <span className="land-logo-text">Astral</span>
        </div>
        <a
          href="https://astral3.io"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none',
            fontFamily: 'var(--font-dm), sans-serif',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
        >
          astral3.io
        </a>
      </nav>

      {/* Main content */}
      <div className="land-content">
        {/* Eyebrow */}
        <div className="land-eyebrow anim-up d-0">
          <span className="land-eyebrow-dot" />
          <span className="land-eyebrow-text">LLMO Intelligence for Web3</span>
        </div>

        {/* Headline */}
        <h1 className="land-headline anim-up d-1">
          Is Your Crypto Project<br />
          <span className="land-headline-accent">Visible to AI?</span>
        </h1>

        {/* Sub */}
        <p className="land-sub anim-up d-2">
          When founders search on Grok, Perplexity, or ChatGPT — your project needs to show up.
          Check your AI visibility in 30 seconds.
        </p>

        {/* Form card */}
        <div className="land-card anim-up d-3">
          <label className="land-field-label">Project URL</label>

          <div style={{ position: 'relative', marginBottom: errors.url ? 4 : 20 }}>
            {/* Globe icon */}
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: '#A1A1AA', fontSize: 15, lineHeight: 1, pointerEvents: 'none',
            }}>
              🌐
            </span>
            <input
              className={`input-field${errors.url ? ' error' : ''}`}
              type="text"
              value={url}
              onChange={setUrl}
              onKeyDown={handleKeyDown}
              placeholder="yourproject.xyz"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ paddingLeft: 42 }}
            />
          </div>
          {errors.url && <FieldError>{errors.url}</FieldError>}
          {errors.url && <div style={{ height: 16 }} />}

          <button
            className="btn-primary"
            onClick={onSubmit}
            style={{ width: '100%', padding: '15px 24px', borderRadius: 10, fontSize: 16 }}
          >
            Check AI Visibility
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <p className="land-hint">Free · No account needed · ~30 seconds</p>
        </div>

        {/* Trust strip */}
        <div className="land-trust anim-up d-4">
          {[
            'No email required',
            'Powered by Claude',
            'Built by Astral',
          ].map((t) => (
            <div key={t} className="land-trust-item">
              <CheckIcon />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
