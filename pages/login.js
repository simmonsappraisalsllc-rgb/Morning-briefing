import { signIn } from 'next-auth/react';
import Head from 'next/head';

export default function Login() {
  return (
    <>
      <Head>
        <title>Sign In — Simmons Appraisals Morning Briefing</title>
      </Head>
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', padding: 24,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 12 }}>
            Simmons Appraisals LLC
          </div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 900, fontSize: '2.4rem',
            color: 'var(--text)', lineHeight: 1.1, marginBottom: 8,
          }}>
            Morning<br /><span style={{ color: 'var(--accent)' }}>Briefing</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--dim)', marginBottom: 40, lineHeight: 1.7 }}>
            Sign in with your Google account to access your Gmail, Calendar, and daily briefing.
          </div>
          <button
            className="run-btn"
            onClick={() => signIn('google', { callbackUrl: '/' })}
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 700, fontSize: '0.9rem',
              letterSpacing: '0.04em',
              padding: '14px 36px',
              background: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none', borderRadius: 4, width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
          <div style={{ fontSize: '0.62rem', color: 'var(--faint)', marginTop: 20, lineHeight: 1.6 }}>
            Requires Gmail (read-only) and Google Calendar (read-only) access.
          </div>
        </div>
      </div>
    </>
  );
}
