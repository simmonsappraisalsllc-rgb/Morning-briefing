import { signIn } from 'next-auth/react';
import Head from 'next/head';

export default function Login() {
  return (
    <>
      <Head><title>Morning Briefing — Simmons Appraisals</title></Head>
      <div style={{
        minHeight: '100vh', display: 'flex',
        background: 'var(--bg)',
        backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(166,124,58,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(30,107,122,0.05) 0%, transparent 50%)',
      }}>
        {/* Left panel */}
        <div style={{
          width: '50%', background: 'var(--navy)', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '60px 72px', position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', border: '1px solid rgba(200,152,58,0.15)' }} />
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(200,152,58,0.1)' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', border: '1px solid rgba(200,152,58,0.08)' }} />

          <div style={{ fontSize: '0.58rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(200,184,160,0.6)', marginBottom: 20 }}>
            Simmons Appraisals LLC · Gainesville, GA
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '5.5rem', lineHeight: 0.9, color: '#fff', marginBottom: 8, letterSpacing: '0.02em',
          }}>
            Morning
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '5.5rem', lineHeight: 0.9, letterSpacing: '0.02em',
            background: 'linear-gradient(135deg, #c8983a 0%, #e8c87a 50%, #a67c3a 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            marginBottom: 32,
          }}>
            Briefing
          </div>
          <div style={{ width: 60, height: 2, background: 'linear-gradient(90deg, #a67c3a, transparent)', marginBottom: 24 }} />
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', color: 'rgba(200,184,160,0.75)', lineHeight: 1.7, fontStyle: 'italic', maxWidth: 320 }}>
            Your daily appraisal intelligence — Gmail, Calendar, market research, and industry news in one click.
          </div>

          {/* Bottom badge */}
          <div style={{ position: 'absolute', bottom: 32, left: 72, fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(200,184,160,0.35)' }}>
            License #338575 · Certified Residential Real Property Appraiser
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
          <div style={{ maxWidth: 360, width: '100%' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.6rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Welcome back, Chris.
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--faint)', marginBottom: 40, lineHeight: 1.7 }}>
              Sign in with your Google account to access your daily briefing.
            </div>

            <button className="run-btn" onClick={() => signIn('google', { callbackUrl: '/' })} style={{
              width: '100%', fontFamily: "'DM Mono', monospace",
              fontWeight: 500, fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '16px 28px', background: 'var(--navy)', color: '#fff',
              border: 'none', borderRadius: 3, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              boxShadow: '0 4px 20px rgba(26,39,68,0.18)',
            }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ fontSize: '0.58rem', color: 'var(--ghost)', marginTop: 20, textAlign: 'center', lineHeight: 1.6 }}>
              Read-only access · Gmail & Google Calendar
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
