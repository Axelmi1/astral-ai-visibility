'use client';

import { useEffect, useState } from 'react';
import { ChatGPTLogo, ClaudeLogo, PerplexityLogo, GeminiLogo } from './AILogos';

const AI_MODELS = [
  { name: 'ChatGPT',    Logo: ChatGPTLogo,    accent: '#10A37F', shadow: 'rgba(16,163,127,0.35)'  },
  { name: 'Claude',     Logo: ClaudeLogo,     accent: '#D97757', shadow: 'rgba(217,119,87,0.35)'  },
  { name: 'Perplexity', Logo: PerplexityLogo, accent: '#20B2AA', shadow: 'rgba(32,178,170,0.35)'  },
  { name: 'Gemini',     Logo: GeminiLogo,     accent: '#4285F4', shadow: 'rgba(66,133,244,0.35)'  },
];

const STATUS_CYCLE = ['Querying...', 'Analyzing...', 'Mapping...', 'Scoring...'];

export default function LoadingScreen({ message, progress }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [doneModels, setDoneModels] = useState([]);
  const [statuses, setStatuses] = useState(AI_MODELS.map(() => 'Waiting'));

  // Cycle "active" model every ~2s, mark previous as done
  useEffect(() => {
    const tick = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % AI_MODELS.length;
        setDoneModels((d) => (d.includes(prev) ? d : [...d, prev]));
        setStatuses((s) => {
          const copy = [...s];
          copy[prev] = 'Done';
          copy[next] = STATUS_CYCLE[next] || 'Analyzing...';
          return copy;
        });
        return next;
      });
    }, 2200);

    // Set first model active immediately
    setStatuses((s) => {
      const copy = [...s];
      copy[0] = STATUS_CYCLE[0];
      return copy;
    });

    return () => clearInterval(tick);
  }, []);

  return (
    <div className="load-root">
      <div className="load-inner">

        {/* Brand */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 18px',
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent-bd)',
            borderRadius: 999,
            marginBottom: 0,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--accent)',
              display: 'block',
              animation: 'pulse-dot 1.5s ease-in-out infinite',
            }} />
            <span className="f-head" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em' }}>
              RUNNING AI VISIBILITY SCAN
            </span>
          </div>
        </div>

        {/* 4 model cards */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 44, flexWrap: 'wrap' }}>
          {AI_MODELS.map(({ name, Logo, accent, shadow }, i) => {
            const isActive = activeIndex === i;
            const isDone   = doneModels.includes(i);
            const status   = statuses[i];

            return (
              <div
                key={name}
                style={{
                  width: 120,
                  background: '#fff',
                  border: `1px solid ${isActive ? accent : isDone ? 'rgba(0,0,0,0.06)' : 'var(--border)'}`,
                  borderRadius: 14,
                  padding: '18px 14px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
                  boxShadow: isActive
                    ? `0 0 0 3px ${accent}20, 0 8px 24px ${shadow}, 0 2px 8px rgba(0,0,0,0.04)`
                    : isDone
                    ? '0 1px 4px rgba(0,0,0,0.04)'
                    : 'none',
                  transform: isActive ? 'translateY(-4px) scale(1.03)' : 'translateY(0) scale(1)',
                  opacity: (!isActive && !isDone && status === 'Waiting') ? 0.45 : 1,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top accent bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: isActive ? accent : isDone ? `${accent}60` : 'transparent',
                  borderRadius: '14px 14px 0 0',
                  transition: 'all 0.4s ease',
                }} />

                {/* Scan shimmer on active */}
                {isActive && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `linear-gradient(135deg, transparent 40%, ${accent}10 60%, transparent 80%)`,
                    animation: 'scanShimmer 1.4s linear infinite',
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Logo */}
                <div style={{
                  width: 44, height: 44,
                  borderRadius: 10,
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${accent}12`,
                  border: `1px solid ${accent}25`,
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? `0 0 12px ${shadow}` : 'none',
                }}>
                  <Logo size={32} />
                </div>

                {/* Name */}
                <span className="f-head" style={{
                  fontSize: 12, fontWeight: 700, color: isActive ? accent : '#18181B',
                  transition: 'color 0.3s ease',
                }}>
                  {name}
                </span>

                {/* Status line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {isDone ? (
                    <span style={{ fontSize: 10, color: '#10B981', fontWeight: 700, fontFamily: 'var(--font-jakarta)' }}>
                      ✓ Done
                    </span>
                  ) : isActive ? (
                    <span style={{ fontSize: 10, color: accent, fontFamily: 'var(--font-jakarta)', fontWeight: 600 }}>
                      {status}
                      <span style={{ display: 'inline-block', animation: 'dotBlink 1s steps(3,end) infinite', letterSpacing: 1 }}>...</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: '#A1A1AA', fontFamily: 'var(--font-jakarta)' }}>
                      Waiting
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Message */}
        <p
          key={message}
          className="anim-in"
          style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 28, textAlign: 'center', fontWeight: 500 }}
        >
          {message}
        </p>

        {/* Progress bar */}
        <div className="load-bar-track" style={{ marginBottom: 8 }}>
          <div
            className="load-bar-fill progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="load-pct" style={{ textAlign: 'center' }}>{Math.round(progress)}%</p>

      </div>

      <style>{`
        @keyframes scanShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes dotBlink {
          0%   { opacity: 0; }
          33%  { opacity: 1; }
          66%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

    </div>
  );
}
