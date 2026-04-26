import React, { useState } from 'react';

const VERDICT_CONFIG = {
  'FAKE':         { color: 'var(--red)',    bg: 'rgba(255,59,92,0.05)',   border: 'rgba(255,59,92,0.3)',   icon: '✕', label: 'FAKE NEWS' },
  'LIKELY FAKE':  { color: '#ff7a42',       bg: 'rgba(255,122,66,0.05)',  border: 'rgba(255,122,66,0.3)',  icon: '⚠', label: 'LIKELY FAKE' },
  'UNCERTAIN':    { color: 'var(--yellow)', bg: 'rgba(255,204,0,0.05)',   border: 'rgba(255,204,0,0.3)',   icon: '?', label: 'UNCERTAIN' },
  'LIKELY REAL':  { color: '#44ddaa',       bg: 'rgba(68,221,170,0.05)',  border: 'rgba(68,221,170,0.3)',  icon: '~', label: 'LIKELY REAL' },
  'REAL':         { color: 'var(--green)',  bg: 'rgba(0,229,160,0.05)',   border: 'rgba(0,229,160,0.3)',   icon: '✓', label: 'VERIFIED REAL' },
};

const CRED_COLORS = {
  'fact-check': '#aa66ff',
  high: 'var(--green)',
  medium: 'var(--yellow)',
  low: 'var(--red)',
  unknown: 'var(--text-muted)',
};

function Markdown({ text }) {
  if (!text) return null;
  const paragraphs = text.split('\n\n');
  return (
    <div>
      {paragraphs.map((para, i) => {
        const parts = para.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} style={{ marginBottom: i < paragraphs.length - 1 ? '12px' : 0, lineHeight: '1.7' }}>
            {parts.map((part, j) =>
              j % 2 === 1
                ? <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{part}</strong>
                : <span key={j}>{part}</span>
            )}
          </p>
        );
      })}
    </div>
  );
}

export default function VerdictCard({ result }) {
  const cfg = VERDICT_CONFIG[result.finalVerdict] || VERDICT_CONFIG['UNCERTAIN'];
  const [activeTab, setActiveTab] = useState('explanation');

  const tabs = [
    { id: 'explanation', label: 'Explanation' },
    { id: 'sources', label: `Sources (${(result.sources || []).length})` },
    { id: 'reasoning', label: 'Reasoning Chain' },
    ...(result.scoreBreakdown?.score != null ? [{ id: 'score', label: 'Score Breakdown' }] : []),
  ];

  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 'var(--radius-lg)',
      padding: '28px',
      animation: 'fade-up 0.4s ease forwards',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '54px', height: '54px', borderRadius: '50%',
            background: `${cfg.color}22`, border: `2px solid ${cfg.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', color: cfg.color, fontWeight: '700',
          }}>
            {cfg.icon}
          </div>
          <div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '3px' }}>
              FINAL VERDICT
            </div>
            <div style={{ fontSize: '24px', fontFamily: 'var(--font-display)', fontWeight: '800', color: cfg.color, letterSpacing: '-0.01em' }}>
              {cfg.label}
            </div>
            {result.modelUsed && (
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>
                via {result.modelUsed.replace(/_/g, ' ').toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <ConfidenceGauge score={result.confidenceScore} color={cfg.color} />
      </div>

      {/* Metric chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <MetricChip label="ML MODEL" value={(result.mlPrediction || 'N/A').toUpperCase()} sub={`${Math.round((result.mlConfidence || 0) * 100)}% conf`} />
        <MetricChip label="SOURCES" value={result.searchResults?.length || 0} sub="found" />
        <MetricChip label="FACT CHECKS" value={(result.sources || []).filter(s => s.type === 'fact-check' || s.credibility === 'fact-check').length} sub="dedicated" />
        <MetricChip label="RAG CHUNKS" value={result.ragChunks?.length || 0} sub="evidence" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px 14px', border: 'none', borderRadius: '6px 6px 0 0',
            cursor: 'pointer', background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
            color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '12px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            borderBottom: activeTab === tab.id ? `2px solid ${cfg.color}` : '2px solid transparent',
            transition: 'all var(--transition)',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ minHeight: '120px' }}>
        {activeTab === 'explanation' && (
          <div>
            {result.citedSources?.length > 0 && (
              <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.08em', marginBottom: '8px' }}>CITED SOURCES</div>
                {result.citedSources.map((cs, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, width: '22px', height: '16px', background: 'var(--blue-dim)', border: '1px solid rgba(68,136,255,0.3)', borderRadius: '3px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>[{cs.ref}]</span>
                    <span style={{ color: CRED_COLORS[cs.credibility] || 'var(--text-muted)', fontSize: '11px', marginRight: '4px' }}>●</span>
                    <a href={cs.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px', lineHeight: '1.4' }}>
                      {cs.source || cs.title}
                      {cs.factCheckRating && <span style={{ color: cfg.color, fontFamily: 'var(--font-mono)', fontSize: '11px', marginLeft: '6px' }}>→ "{cs.factCheckRating}"</span>}
                    </a>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              <Markdown text={result.explanation} />
            </div>
          </div>
        )}
        {activeTab === 'sources' && <SourcesList sources={result.sources || []} />}
        {activeTab === 'reasoning' && <ReasoningChain steps={result.reasoningSteps || result.ragChunks || []} />}
        {activeTab === 'score' && result.scoreBreakdown && <ScoreBreakdown breakdown={result.scoreBreakdown} color={cfg.color} />}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          Analyzed in {result.processingTimeMs}ms
        </span>
      </div>
    </div>
  );
}

function ConfidenceGauge({ score, color }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ textAlign: 'center', flexShrink: 0 }}>
      <svg width="76" height="76" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="38" cy="38" r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle cx="38" cy="38" r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div style={{ marginTop: '-50px', marginBottom: '6px', fontSize: '17px', fontFamily: 'var(--font-display)', fontWeight: '800', color }}>{score}%</div>
      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>CONFIDENCE</div>
    </div>
  );
}

function MetricChip({ label, value, sub }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: '700', color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>
    </div>
  );
}

function SourcesList({ sources }) {
  if (!sources.length) return (
    <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '24px' }}>No sources found</div>
  );
  const factChecks = sources.filter(s => s.type === 'fact-check' || s.credibility === 'fact-check');
  const others = sources.filter(s => s.type !== 'fact-check' && s.credibility !== 'fact-check');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {[...factChecks, ...others].map((src, i) => {
        const isFC = src.type === 'fact-check' || src.credibility === 'fact-check';
        const credColor = CRED_COLORS[src.credibility] || CRED_COLORS.unknown;
        return (
          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: isFC ? 'rgba(170,102,255,0.05)' : 'rgba(0,0,0,0.2)', border: `1px solid ${isFC ? 'rgba(170,102,255,0.2)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '10px 12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '5px', flexShrink: 0, background: credColor }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {isFC && src.factCheckRating && (
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#aa66ff', background: 'rgba(170,102,255,0.1)', border: '1px solid rgba(170,102,255,0.2)', borderRadius: '4px', padding: '2px 8px', display: 'inline-block', marginBottom: '4px' }}>
                  FACT CHECK: "{src.factCheckRating}"
                </div>
              )}
              <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '13px', color: 'var(--blue)', textDecoration: 'none', fontWeight: '500', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.title || src.source}</a>
              {src.snippet && <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{src.snippet}</p>}
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: credColor }}>{src.credibility}</span>
              {src.publishedAt && <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{new Date(src.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReasoningChain({ steps }) {
  if (!steps.length) return <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>No reasoning steps available</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--blue)', padding: '2px 7px', background: 'var(--blue-dim)', border: '1px solid rgba(68,136,255,0.2)', borderRadius: '4px', flexShrink: 0, marginTop: '1px', minWidth: '28px', textAlign: 'center' }}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: '1.5' }}>{step}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreBreakdown({ breakdown, color }) {
  const fields = [
    { label: 'ML Model', key: 'ml_contribution' },
    { label: 'Fact Checks', key: 'factcheck_contribution' },
    { label: 'Source Quality', key: 'source_contribution' },
    { label: 'RAG Evidence', key: 'rag_contribution' },
    { label: 'Linguistic', key: 'linguistic_contribution' },
    { label: 'Contradictions', key: 'contradiction_penalty' },
  ];
  const maxAbs = 40;
  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>COMPOSITE SCORE</span>
        <span style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: '800', color }}>{breakdown.score > 0 ? '+' : ''}{breakdown.score?.toFixed(1)}</span>
      </div>
      {fields.map(({ label, key }) => {
        const val = breakdown[key] ?? 0;
        const pct = Math.abs(val / maxAbs) * 100;
        const barColor = val > 0 ? 'var(--green)' : val < 0 ? 'var(--red)' : 'var(--text-muted)';
        return (
          <div key={key} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: barColor }}>{val > 0 ? '+' : ''}{val.toFixed(1)}</span>
            </div>
            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, height: '100%', left: val < 0 ? `${50 - pct / 2}%` : '50%', width: `${pct / 2}%`, background: barColor, borderRadius: '2px' }} />
              <div style={{ position: 'absolute', top: '-3px', left: '50%', width: '2px', height: '10px', background: 'var(--border-bright)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
