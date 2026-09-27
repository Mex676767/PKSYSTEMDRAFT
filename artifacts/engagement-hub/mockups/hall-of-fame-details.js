// Concept-only content. These displays do not award or verify real records.
document.querySelectorAll('.royal-place .avatar,.exec-person .avatar').forEach(avatar => {
  const branch = '<path d="M48 126C10 108 5 52 30 23" fill="none" stroke="#caa45b" stroke-width="2"/>' + [0,1,2,3,4,5].map(i => `<ellipse cx="${18 + Math.abs(i-2)*3}" cy="${38+i*14}" rx="4" ry="10" fill="#d5b46f" transform="rotate(${i*9-40} ${18+Math.abs(i-2)*3} ${38+i*14})"/>`).join('');
  avatar.insertAdjacentHTML('beforeend', `<svg class="laurel-art" viewBox="0 0 140 140" aria-hidden="true">${branch}<g transform="translate(140 0) scale(-1 1)">${branch}</g></svg>`);
});
document.querySelectorAll('[data-group="podium"] .frame').forEach(stage => {
  stage.insertAdjacentHTML('afterbegin', '<div class="stage-stars"></div><div class="stage-light left"></div><div class="stage-light right"></div><div class="stage-trim"></div>');
  stage.insertAdjacentHTML('beforeend', '<div class="plinth-base"></div>');
});
document.querySelectorAll('.royal-place,.exec-person,.neon-side').forEach(place => {
  const rank = place.querySelector('.place-number');
  const detail = document.createElement('div');
  detail.className = 'rank-detail';
  detail.innerHTML = '<span>RTN VIP</span><span>SEP / 2026</span><span>TOP PERFORMER</span>';
  if (rank) place.insertBefore(detail, rank); else place.append(detail);
});
document.querySelector('.royal-place.first .person-role').textContent = 'Monthly champion';
const concepts = [
  { id:'cert-1', theme:'', name:'A · Official Registry', color:'#214c52', description:'Portrait format inspired by your reference: a large circular C9MYR emblem, security-paper texture, centered record statement, and a foil-style validation seal.' },
  { id:'cert-2', theme:'gold', name:'B · Gold Archive', color:'#87662e', description:'The same official portrait structure on warm ivory stock, with engraved gold framing and an archival award feel.' },
  { id:'cert-3', theme:'navy', name:'C · Midnight Registry', color:'#293b52', description:'A dark edition with gold edging and a luminous seal, designed to feel at home in the C9MYR Hub.' }
];
function emblem(id,color) {
  return `<svg class="registry-emblem" viewBox="0 0 240 240" aria-label="C9MYR Guinness Record emblem" role="img"><defs><path id="${id}-top" d="M 35,120 A 85,85 0 0,1 205,120"/><path id="${id}-bottom" d="M 25,120 A 95,95 0 0,0 215,120"/></defs><circle cx="120" cy="120" r="115" fill="${color}"/><circle cx="120" cy="120" r="110" fill="none" stroke="#d6d8c9" stroke-width="2"/><circle cx="120" cy="120" r="76" fill="#fafaf3"/><text fill="white" font-size="23"><textPath href="#${id}-top" startOffset="50%" text-anchor="middle">C9MYR</textPath></text><text fill="white" font-size="18"><textPath href="#${id}-bottom" startOffset="50%" text-anchor="middle">GUINNESS RECORD</textPath></text><path d="m120 57 7 16 18 2-13 12 4 18-16-9-16 9 4-18-13-12 18-2z" fill="#c8a046"/><path d="M94 110h52v11c0 20-11 28-22 32v13h15v7h-38v-7h15v-13c-11-4-22-12-22-32z M94 115H81v8c0 14 9 21 21 21 M146 115h13v8c0 14-9 21-21 21" fill="none" stroke="${color}" stroke-width="5"/><text x="120" y="184" text-anchor="middle" fill="${color}" font-size="8">COMPANY HONORS</text></svg>`;
}
concepts.forEach(c => {
  document.querySelector(`[data-show="${c.id}"]`).textContent = c.name;
  document.getElementById(c.id).innerHTML = `<div class="frame cert-frame"><article class="portrait-cert ${c.theme}"><div class="portrait-border"><div class="security-paper"></div><div class="portrait-body"><span class="sample-chip">DESIGN SAMPLE</span>${emblem(c.id,c.color)}<h3 class="cert-heading">CERTIFICATE</h3><div class="cert-subtitle">C9MYR GUINNESS RECORD · COMPANY ACHIEVEMENT</div><p class="portrait-statement">The C9MYR company record for<br><strong>Fastest PR Merge</strong><br>was achieved by <strong>@Yaro</strong><br>of the RTN VIP department,<br>with a verified completion time of</p><div class="portrait-result">4 minutes 12 seconds</div><p class="portrait-date">Recorded on 22 September 2026<br>C9MYR Employee’s Hub</p><div class="certificate-bottom"><div class="registry-signature">AUTHORISED RECORD VALIDATION<br>September 2026</div><div class="hologram">C9MYR<br>RECORD<br>VERIFIED</div></div><div class="registry-motto">EXCELLENCE <span>RECOGNISED</span></div><div class="registry-id">SAMPLE RECORD ID · C9-GR-2026-00917</div></div></div></article></div><div class="concept-note"><span class="option-no">${c.name[0]}</span><div><b>${c.name.slice(4)}</b><br>${c.description}</div></div>`;
});
