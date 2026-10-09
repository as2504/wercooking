// Lightweight generated "photos" for seed Kitchen Updates (no stock images, works offline).

const PALETTES: [string, string][] = [
  ['#FDE6C8', '#F6B26B'],
  ['#E6F4E1', '#9CCB86'],
  ['#FFE1D6', '#F28E6B'],
  ['#FFF3C4', '#F5C542'],
  ['#E8E2F7', '#B6A4E0'],
  ['#DDF1F4', '#7FC4CF'],
];

export function dishIllustration(emojis: string[], variant = 0, caption = ''): string {
  const [a, b] = PALETTES[variant % PALETTES.length];
  const ring = emojis.slice(0, 6);
  const cx = 400;
  const cy = 290;
  const items = ring
    .map((e, i) => {
      const angle = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
      const r = ring.length > 1 ? 120 : 0;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r * 0.8;
      return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-size="96" text-anchor="middle" dominant-baseline="central">${e}</text>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="800" height="560" fill="url(#g)"/>
<ellipse cx="${cx}" cy="${cy + 14}" rx="270" ry="210" fill="rgba(0,0,0,.08)"/>
<ellipse cx="${cx}" cy="${cy}" rx="265" ry="205" fill="#fffaf3"/>
<ellipse cx="${cx}" cy="${cy}" rx="225" ry="172" fill="none" stroke="#f0e2cf" stroke-width="6"/>
${items}
${caption ? `<text x="28" y="530" font-family="Inter,Arial" font-size="26" font-weight="600" fill="rgba(43,29,20,.75)">${caption}</text>` : ''}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
