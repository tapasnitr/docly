import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = "Docly | Your team's second brain";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#0f172a',
              border: '2px solid #818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
              color: '#818cf8',
            }}
          >
            D
          </div>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em' }}>Docly</div>
        </div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 60, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          Turn your team&apos;s knowledge
        </div>
        <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#a5b4fc' }}>
          into an AI-powered workspace
        </div>
        <div style={{ display: 'flex', marginTop: 32, fontSize: 26, color: '#cbd5e1' }}>
          Multi-tenant workspaces · Projects · Documents · AI knowledge assistant
        </div>
      </div>
    ),
    { ...size }
  );
}
