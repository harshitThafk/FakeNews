import React from 'react';

const STAGES = [
  { id: 'input', label: 'Input Processing', desc: 'Extracting text / scraping URL' },
  { id: 'ml', label: 'ML Classification', desc: 'TF-IDF + Logistic Regression' },
  { id: 'search', label: 'Live Search', desc: 'Fetching corroborating sources' },
  { id: 'rag', label: 'RAG Retrieval', desc: 'Embedding + FAISS vector search' },
  { id: 'agent', label: 'Agentic Reasoning', desc: 'Multi-step synthesis' },
];

export default function PipelineProgress({ activeStage }) {
  const activeIdx = STAGES.findIndex((s) => s.id === activeStage);

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', animation: 'fade-up 0.3s ease forwards' }}>
      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '20px' }}>PIPELINE RUNNING</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {STAGES.map((stage, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: i > activeIdx ? 0.3 : 1, transition: 'opacity 0.3s' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)', flexShrink: 0, background: done ? 'rgba(68,204,136,0.15)' : active ? 'rgba(68,136,255,0.15)' : 'var(--bg-elevated)', border: `1px solid ${done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--border)'}`, color: done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--text-muted)' }}>
                {done ? '✓' : i + 1}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: active ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                  {stage.label}
                  {active && <span style={{ marginLeft: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--blue)', animation: 'pulse 1s infinite' }}>●</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{stage.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
