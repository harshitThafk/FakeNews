import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const nav = [
    { path: '/', label: 'ANALYZE' },
    { path: '/history', label: 'HISTORY' },
    { path: '/dashboard', label: 'DASHBOARD' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '56px', position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Verit<span style={{ color: 'var(--blue)' }}>AI</span>
          </span>
        </Link>
        <nav style={{ display: 'flex', gap: '4px' }}>
          {nav.map(({ path, label }) => (
            <Link key={path} to={path} style={{
              padding: '6px 12px', borderRadius: 'var(--radius)',
              fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: '500',
              letterSpacing: '0.06em', textDecoration: 'none',
              color: pathname === path ? 'var(--text-primary)' : 'var(--text-muted)',
              background: pathname === path ? 'var(--bg-elevated)' : 'transparent',
              transition: 'all var(--transition)',
            }}>{label}</Link>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
      <footer style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', textAlign: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
        VERITAI — ML + RAG + AGENTIC AI FAKE NEWS DETECTOR
      </footer>
    </div>
  );
}
