import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getHistory, deleteCheck } from '../utils/api';

const VERDICT_COLORS = { 'FAKE': 'var(--red)', 'LIKELY FAKE': '#ff8844', 'UNCERTAIN': 'var(--yellow)', 'LIKELY REAL': '#88cc44', 'REAL': 'var(--green)' };

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory().then(setItems).catch(() => toast.error('Failed to load history')).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    try {
      await deleteCheck(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  };

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>LOADING...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '24px', marginBottom: '24px', letterSpacing: '-0.02em' }}>Analysis History</h2>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>NO HISTORY YET — RUN AN ANALYSIS FIRST</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item) => (
            <div key={item.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.originalInput?.slice(0, 100)}</div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: '700', color: VERDICT_COLORS[item.finalVerdict] || 'var(--text-muted)' }}>{item.finalVerdict}</span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{item.confidenceScore}% confidence</span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => handleDelete(item.id)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-mono)', transition: 'all var(--transition)', flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>DELETE</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
