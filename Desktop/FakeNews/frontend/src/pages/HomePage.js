import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { submitCheck, pollResult } from '../utils/api';
import VerdictCard from '../components/VerdictCard';
import PipelineProgress from '../components/PipelineProgress';

const PIPELINE_STAGES = ['input', 'ml', 'search', 'rag', 'agent'];

const EXAMPLES = [
  { type: 'fake', text: 'SHOCKING: Scientists discover miracle cure Big Pharma is hiding from you!' },
  { type: 'real', text: 'Federal Reserve raises interest rates by 0.25% following monthly policy meeting.' },
  { type: 'fake', text: 'EXPOSED: Deep state conspiracy to control water supply revealed by whistleblower.' },
  { type: 'real', text: 'Researchers at MIT publish findings on new battery technology in Nature journal.' },
];

export default function HomePage() {
  const [inputMode, setInputMode] = useState('text');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeStage, setActiveStage] = useState(null);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setLoading(true);
    setResult(null);
    setActiveStage('input');

    try {
      const payload = inputMode === 'url' ? { url: inputValue.trim() } : { text: inputValue.trim() };
      const { id } = await submitCheck(payload);
      toast.success('Analysis started', { duration: 2000 });

      let stageIdx = 0;
      const stageTimer = setInterval(() => {
        stageIdx = Math.min(stageIdx + 1, PIPELINE_STAGES.length - 1);
        setActiveStage(PIPELINE_STAGES[stageIdx]);
      }, 3500);

      const finalData = await pollResult(id, (data) => {
        if (data.status === 'completed') { clearInterval(stageTimer); setActiveStage(null); }
      });

      clearInterval(stageTimer);
      setResult(finalData);
      setActiveStage(null);
      setLoading(false);
    } catch (err) {
      toast.error(err.message || 'Analysis failed');
      setLoading(false);
      setActiveStage(null);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.trim().startsWith('http://') || val.trim().startsWith('https://')) setInputMode('url');
    else setInputMode('text');
  };

  const inputStyle = {
    width: '100%', padding: '16px',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
    fontSize: '14px', fontFamily: 'var(--font-body)',
    outline: 'none', transition: 'border-color var(--transition)',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--blue-dim)', border: '1px solid rgba(68,136,255,0.2)', borderRadius: '20px', padding: '4px 14px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--blue)', letterSpacing: '0.08em', marginBottom: '20px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--blue)', display: 'inline-block' }} />
          ML + RAG + AGENTIC AI
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: 'clamp(32px, 6vw, 52px)', color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: '1.1', marginBottom: '16px' }}>
          Detect Fake News<br />
          <span style={{ background: 'linear-gradient(135deg, var(--blue), var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>with Agentic AI</span>
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', lineHeight: '1.7' }}>
          Paste article text or a URL. Our pipeline runs ML classification, live search corroboration, RAG retrieval, and agentic reasoning.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {['text', 'url'].map(mode => (
            <button key={mode} type="button" onClick={() => setInputMode(mode)} style={{ padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: '500', letterSpacing: '0.05em', cursor: 'pointer', border: 'none', background: inputMode === mode ? 'var(--bg-elevated)' : 'transparent', color: inputMode === mode ? 'var(--text-primary)' : 'var(--text-muted)', outline: inputMode === mode ? '1px solid var(--border-bright)' : '1px solid transparent', transition: 'all var(--transition)' }}>
              {mode === 'text' ? '📄 TEXT' : '🔗 URL'}
            </button>
          ))}
        </div>

        {inputMode === 'text' ? (
          <textarea value={inputValue} onChange={handleInputChange} placeholder="Paste article text here to analyze..." rows={7} style={{ ...inputStyle, lineHeight: '1.6', resize: 'vertical' }} onFocus={e => e.target.style.borderColor = 'var(--border-bright)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} disabled={loading} />
        ) : (
          <input value={inputValue} onChange={handleInputChange} placeholder="https://example.com/article..." type="url" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} onFocus={e => e.target.style.borderColor = 'var(--border-bright)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} disabled={loading} />
        )}

        <button type="submit" disabled={loading || !inputValue.trim()} style={{ marginTop: '12px', width: '100%', padding: '14px 24px', borderRadius: 'var(--radius-lg)', border: 'none', cursor: loading || !inputValue.trim() ? 'not-allowed' : 'pointer', background: loading || !inputValue.trim() ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--blue), #6644ff)', color: loading || !inputValue.trim() ? 'var(--text-muted)' : 'white', fontSize: '14px', fontFamily: 'var(--font-display)', fontWeight: '700', letterSpacing: '0.02em', transition: 'all var(--transition)', boxShadow: loading || !inputValue.trim() ? 'none' : '0 4px 20px rgba(68,136,255,0.3)' }}>
          {loading ? '⟳  ANALYZING...' : '→  ANALYZE'}
        </button>
      </form>

      {/* Examples */}
      {!loading && !result && (
        <div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '12px' }}>TRY THESE EXAMPLES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {EXAMPLES.map((ex, i) => (
              <button key={i} type="button" onClick={() => { setInputMode('text'); setInputValue(ex.text); }} style={{ textAlign: 'left', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'all var(--transition)', color: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: ex.type === 'fake' ? 'var(--red)' : 'var(--green)', marginRight: '10px', letterSpacing: '0.06em' }}>[{ex.type.toUpperCase()}]</span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{ex.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && activeStage && <PipelineProgress activeStage={activeStage} />}

      {result && !loading && (
        <div>
          <VerdictCard result={result} />
          <button onClick={() => { setResult(null); setInputValue(''); }} style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-mono)', transition: 'all var(--transition)' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            ← NEW ANALYSIS
          </button>
        </div>
      )}
    </div>
  );
}
