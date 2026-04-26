import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getStats } from '../utils/api';

const COLORS = ['var(--red)', '#ff8844', 'var(--yellow)', '#88cc44', 'var(--green)'];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => { getStats().then(setStats).catch(() => {}); }, []);

  const chartData = stats ? [
    { name: 'Fake', value: stats.fake },
    { name: 'Real', value: stats.real },
    { name: 'Uncertain', value: stats.uncertain },
  ].filter(d => d.value > 0) : [];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '24px', marginBottom: '32px', letterSpacing: '-0.02em' }}>Dashboard</h2>

      {/* Stats grid */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '40px' }}>
          {[
            { label: 'TOTAL CHECKS', value: stats.total, color: 'var(--blue)' },
            { label: 'FAKE / LIKELY FAKE', value: stats.fake, color: 'var(--red)' },
            { label: 'REAL / LIKELY REAL', value: stats.real, color: 'var(--green)' },
            { label: 'UNCERTAIN', value: stats.uncertain, color: 'var(--yellow)' },
            { label: 'AVG TIME', value: `${Math.round(stats.avgProcessingTimeMs)}ms`, color: 'var(--text-secondary)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</div>
              <div style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-display)', color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '40px' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '16px' }}>VERDICT DISTRIBUTION</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Architecture */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '16px' }}>PIPELINE ARCHITECTURE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { step: '01', label: 'Input Processor', tech: 'Text | URL Scraper (Cheerio)', color: 'var(--blue)' },
            { step: '02', label: 'ML Classifier', tech: 'TF-IDF + Logistic Regression', color: 'var(--purple)' },
            { step: '03', label: 'Live Search', tech: 'SerpAPI / NewsAPI', color: 'var(--yellow)' },
            { step: '04', label: 'RAG Pipeline', tech: 'SentenceTransformers + FAISS', color: '#ff8844' },
            { step: '05', label: 'Agentic Reasoner', tech: 'Multi-step synthesis + optional GPT-3.5', color: 'var(--green)' },
          ].map(({ step, label, tech, color }) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${color}` }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: '24px' }}>{step}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{tech}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
