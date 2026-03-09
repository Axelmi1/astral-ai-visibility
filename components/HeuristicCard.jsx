export default function HeuristicCard({ icon, title, desc, status, statusClass }) {
  return (
    <div style={{ border: '1px solid #F3F4F6', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
          <p className="aiv-h" style={{ fontWeight: 700, color: '#1A1A2E', fontSize: 13 }}>{title}</p>
        </div>
        <span
          className={statusClass}
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: 100,
            letterSpacing: '0.02em',
            fontFamily: 'var(--font-jakarta), sans-serif',
            flexShrink: 0,
          }}
        >
          {status}
        </span>
      </div>
      <p style={{ color: '#6B7280', fontSize: 13, marginLeft: 24, lineHeight: 1.55 }}>{desc}</p>
    </div>
  );
}
