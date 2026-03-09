'use client';
import { useState } from 'react';

export default function EmailGate({ projectName, score, onUnlock }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const scoreColor = score >= 70 ? '#16A34A' : score >= 40 ? '#CA8A04' : '#DC2626';
  const scoreLabel = score >= 70 ? 'GOOD' : score >= 40 ? 'FAIR' : 'CRITICAL';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.includes('@')) { setError('Enter a valid email'); return; }
    setLoading(true);
    try {
      await fetch('/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, project: projectName, score }),
      });
    } catch { /* silent */ }
    localStorage.setItem('ai_visibility_email', email);
    setLoading(false);
    onUnlock(email);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px',
    }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>

        {/* Score teaser */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '40px 32px 36px',
          boxShadow: 'var(--shadow-lg)', marginBottom: 16,
        }}>
          <p className="section-label" style={{ marginBottom: 16 }}>
            AI Visibility Score for {projectName}
          </p>

          {/* Big score */}
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            background: `${scoreColor}15`,
            border: `4px solid ${scoreColor}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 11, color: scoreColor, fontWeight: 700, letterSpacing: '0.06em' }}>/100</span>
          </div>

          <div style={{
            display: 'inline-block', padding: '4px 14px',
            background: `${scoreColor}15`, border: `1px solid ${scoreColor}40`,
            borderRadius: 999, marginBottom: 28,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor, fontFamily: 'var(--font-jakarta)' }}>
              {scoreLabel}
            </span>
          </div>

          {/* Blurred preview */}
          <div style={{ position: 'relative', marginBottom: 28 }}>
            <div style={{
              filter: 'blur(5px)', pointerEvents: 'none', opacity: 0.6,
              background: 'var(--surface-2)', borderRadius: 10, padding: '16px',
              fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8,
            }}>
              <div style={{ background: 'var(--border)', height: 12, borderRadius: 6, marginBottom: 8, width: '85%' }} />
              <div style={{ background: 'var(--border)', height: 12, borderRadius: 6, marginBottom: 8, width: '70%' }} />
              <div style={{ background: 'var(--border)', height: 12, borderRadius: 6, width: '90%' }} />
            </div>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', background: 'var(--surface)', padding: '6px 16px', borderRadius: 999, border: '1px solid var(--border)' }}>
                🔒 Full report below
              </span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.5 }}>
              Enter your email to unlock the full audit — competitors, GEO gaps, and your custom implementation plan.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: error ? 8 : 0 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="founder@yourproject.io"
                className="input-field"
                style={{ flex: 1, fontSize: 14 }}
                autoFocus
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ whiteSpace: 'nowrap', minWidth: 120 }}
              >
                {loading ? 'Unlocking...' : 'See Full Report →'}
              </button>
            </div>
            {error && <p style={{ fontSize: 12, color: '#DC2626', textAlign: 'left' }}>{error}</p>}
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
              No spam. We'll send your personalized LLMO roadmap.
            </p>
          </form>
        </div>

      </div>
    </div>
  );
}
