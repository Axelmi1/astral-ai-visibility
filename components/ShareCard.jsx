'use client';
import { useRef, useState } from 'react';

export default function ShareCard({ projectName, score, mentionStrength }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const scoreColor = score >= 70 ? '#16A34A' : score >= 40 ? '#CA8A04' : '#DC2626';
  const scoreLabel = score >= 70 ? 'GOOD' : score >= 40 ? 'FAIR' : 'CRITICAL';
  const strengthLabel = {
    strong: 'Top AI recommendation',
    moderate: 'Clearly recommended',
    weak: 'Mentioned peripherally',
    invisible: 'Not visible to AI',
  }[mentionStrength] || 'Not visible to AI';

  async function generateAndDownload() {
    setGenerating(true);
    const canvas = canvasRef.current;
    const W = 1200, H = 630;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // Grid pattern
    ctx.strokeStyle = 'rgba(119,79,210,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Purple glow top-left
    const glow = ctx.createRadialGradient(200, 150, 0, 200, 150, 400);
    glow.addColorStop(0, 'rgba(119,79,210,0.25)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Card
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.strokeStyle = 'rgba(119,79,210,0.3)';
    ctx.lineWidth = 1;
    roundRect(ctx, 60, 60, W - 120, H - 120, 24);
    ctx.fill();
    ctx.stroke();

    // "AI VISIBILITY SCORE" label
    ctx.fillStyle = '#9b77e6';
    ctx.font = 'bold 14px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('AI VISIBILITY SCORE', 100, 130);

    // Project name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(projectName.length > 24 ? projectName.slice(0, 22) + '…' : projectName, 100, 210);

    // Score circle
    const cx = 900, cy = 315, r = 140;
    // Outer ring bg
    ctx.strokeStyle = 'rgba(119,79,210,0.2)';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    // Score arc
    const pct = score / 100;
    ctx.strokeStyle = scoreColor;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();
    // Score number
    ctx.fillStyle = scoreColor;
    ctx.font = 'bold 80px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(score, cx, cy + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '16px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText('out of 100', cx, cy + 50);
    ctx.textAlign = 'left';

    // Score label badge
    ctx.fillStyle = `${scoreColor}25`;
    ctx.strokeStyle = `${scoreColor}60`;
    ctx.lineWidth = 1;
    roundRect(ctx, 100, 240, 130, 36, 18);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = scoreColor;
    ctx.font = 'bold 13px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(scoreLabel, 134, 264);

    // Mention status
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '18px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(strengthLabel, 100, 340);

    // Divider
    ctx.fillStyle = 'rgba(119,79,210,0.3)';
    ctx.fillRect(100, 420, 600, 1);

    // astral3 branding
    ctx.fillStyle = '#774fd2';
    ctx.font = 'bold 16px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText('⚡ astral3.io', 100, 475);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '14px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText('AI Visibility & LLMO Intelligence', 100, 500);

    // CTA
    ctx.fillStyle = '#9b77e6';
    ctx.font = '14px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText('Test your project → visibility.astral3.io', 100, 540);

    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}-ai-visibility.png`;
    a.click();
    URL.revokeObjectURL(url);
    setGenerating(false);
  }

  async function copyText() {
    const text = `🔍 I just checked how visible ${projectName} is to AI models (ChatGPT, Claude, Perplexity, Gemini).\n\nAI Visibility Score: ${score}/100 — ${scoreLabel}\n${strengthLabel}\n\nTest your Web3 project → visibility.astral3.io`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <button
        className="btn-ghost"
        onClick={generateAndDownload}
        disabled={generating}
        style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {generating ? '⏳ Generating...' : '⬇️ Download score card'}
      </button>
      <button
        className="btn-ghost"
        onClick={copyText}
        style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {copied ? '✅ Copied!' : '📋 Copy for LinkedIn'}
      </button>
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
