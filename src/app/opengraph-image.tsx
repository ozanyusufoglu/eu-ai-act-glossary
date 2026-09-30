import { ImageResponse } from 'next/og';
import { LAW_COLORS } from '@/lib/graphData';
import { siteDescription, siteName } from '@/lib/site';

export const alt = `${siteName}: an interactive 3D map of AI Act, GDPR and Shadow AI terms`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// A flat hint of the graph: one hub, satellites coloured by law, a few cross-links.
const hub = { x: 860, y: 315, color: LAW_COLORS.aiact };
const satellites = [
  { x: 1030, y: 170, r: 16, color: LAW_COLORS.gdpr },
  { x: 1090, y: 330, r: 13, color: LAW_COLORS.aiact },
  { x: 1000, y: 480, r: 15, color: LAW_COLORS.other },
  { x: 820, y: 530, r: 12, color: LAW_COLORS.gdpr },
  { x: 680, y: 430, r: 14, color: LAW_COLORS.both },
  { x: 690, y: 190, r: 12, color: LAW_COLORS.other },
  { x: 850, y: 110, r: 13, color: LAW_COLORS.aiact },
];
const crossLinks: [number, number][] = [[1, 2], [3, 4], [4, 5], [2, 3]];
const contrastLink: [number, number] = [0, 6]; // drawn dashed, like an "often confused" edge

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#e8e8ea',
          position: 'relative',
        }}
      >
        <svg width="1200" height="630" style={{ position: 'absolute', top: 0, left: 0 }}>
          {satellites.map((s, i) => (
            <line key={`h${i}`} x1={hub.x} y1={hub.y} x2={s.x} y2={s.y} stroke="#111" strokeOpacity="0.25" strokeWidth="2" />
          ))}
          {crossLinks.map(([a, b], i) => (
            <line key={`c${i}`} x1={satellites[a].x} y1={satellites[a].y} x2={satellites[b].x} y2={satellites[b].y} stroke="#111" strokeOpacity="0.1" strokeWidth="2" />
          ))}
          <line
            x1={satellites[contrastLink[0]].x} y1={satellites[contrastLink[0]].y}
            x2={satellites[contrastLink[1]].x} y2={satellites[contrastLink[1]].y}
            stroke={LAW_COLORS.both} strokeWidth="2.5" strokeDasharray="8 6"
          />
          <circle cx={hub.x} cy={hub.y} r="30" fill={hub.color} />
          {satellites.map((s, i) => (
            <circle key={`n${i}`} cx={s.x} cy={s.y} r={s.r} fill={s.color} />
          ))}
        </svg>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 80px',
            width: 620,
            height: '100%',
          }}
        >
          <div style={{ fontSize: 22, letterSpacing: 6, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>
            Interactive 3D graph
          </div>
          <div style={{ fontSize: 76, fontWeight: 700, color: '#111', lineHeight: 1.05, marginTop: 20 }}>
            {siteName}
          </div>
          <div style={{ fontSize: 26, color: 'rgba(0,0,0,0.55)', lineHeight: 1.4, marginTop: 28 }}>
            {`${siteDescription.split('. ')[0]}.`}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
