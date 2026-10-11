(() => {
  const root = document.getElementById('cosmetics-studio');
  const concepts = [
    { id:'phoenix', name:'Solar Phoenix', c1:'#ffbb65', c2:'#ff527e', description:'Flame-tipped wings, a molten ring, and rising embers.', border:'Solar flare', decoration:'Phoenix wings' },
    { id:'reactor', name:'Neon Overdrive', c1:'#61f1fc', c2:'#ee6aff', description:'Counter-rotating circuits with a charged electric aura.', border:'Reactor ring', decoration:'Plasma arcs' },
    { id:'koi', name:'Moonlit Koi', c1:'#6fe5cc', c2:'#ffe1a0', description:'Two luminous koi swimming through a rippling moon pool.', border:'Ripple pool', decoration:'Twin koi' },
    { id:'crown', name:'Prism Sovereign', c1:'#dab1ff', c2:'#77ddff', description:'A floating crystal crown with orbiting diamond shards.', border:'Prism facets', decoration:'Crystal crown' },
    { id:'void', name:'Event Horizon', c1:'#bb98ff', c2:'#ff87c8', description:'A tilted accretion disc pulling a starfield into orbit.', border:'Gravity well', decoration:'Stardust orbit' },
    { id:'bloom', name:'Starlight Bloom', c1:'#ff9fcf', c2:'#ffdaae', description:'A living floral wreath with drifting petals and butterflies.', border:'Starflower wreath', decoration:'Butterfly duet' },
  ];
  let serial = 0;
  let selected = concepts[0];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motion = document.getElementById('motion');
  const star = (x,y,size=4) => `<path d="M${x} ${y-size} Q${x} ${y} ${x+size} ${y} Q${x} ${y} ${x} ${y+size} Q${x} ${y} ${x-size} ${y} Q${x} ${y} ${x} ${y-size}" fill="var(--c1)"/>`;
  const particles = (color='var(--c1)') => `<g class="particles" fill="${color}">${[[61,76],[220,62],[41,155],[245,176],[82,211],[211,225],[168,45],[267,109]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i%3+1}" style="--delay:-${i*.45}s"/>${i%2===0?star(x+9,y-9,3):''}`).join('')}</g>`;
  const circle = (radius,attrs='') => `<circle class="orbit-line" cx="150" cy="140" r="${radius}" ${attrs}/>`;
  const fox = `<g class="avatar-layer"><circle cx="150" cy="140" r="54" fill="#302341" stroke="#f2d3ff" stroke-opacity=".32" stroke-width="1.5"/><circle cx="150" cy="140" r="49" fill="#3d2a51"/><path d="m117 127-5-31 27 17M163 113l25-17-6 33" fill="#f89d57" stroke="#ffca87" stroke-width="2"/><path d="m119 116-3-12 15 11m42 0 11-11-2 13" fill="#5c3452"/><path d="M114 129q7-19 36-20 29 1 36 20l-9 28-27 19-27-19z" fill="#ee9453"/><path d="m115 134 35 22 35-22-8 23-27 19-27-19z" fill="#fff0d7"/><path d="m136 153 14 4 14-4-14 14z" fill="#3c2745"/><path d="m126 137 9 3m30 0 9-3" stroke="#392443" stroke-width="3" stroke-linecap="round"/><path d="m128 147 5 1m34 0 5-1" stroke="#fdab9b" stroke-width="3" stroke-linecap="round"/><path d="M150 166v4" stroke="#3c2745" stroke-width="2" stroke-linecap="round"/></g>`;
  function layers(c, uid) {
    const grad=`url(#${uid}-metal)`;
    if(c.id==='phoenix') {
      const wing=`<g class="wing"><path d="M104 171C47 170 18 113 24 64c17 24 28 26 43 31-3-12-3-20 0-31 13 22 20 41 30 48l13 30z" fill="${grad}" opacity=".88"/><path d="M101 156C52 148 31 108 31 79M97 145C63 127 60 109 59 98M100 135c-15-13-24-33-26-45" fill="none" stroke="#fff2bb" stroke-width="2"/><path d="M89 166C54 156 44 137 43 122M80 165c-26-7-39-22-41-29" fill="none" stroke="#ff8658" stroke-width="4" stroke-linecap="round"/></g>`;
      return { back:`<g class="decoration-layer soft-glow">${wing}<g transform="translate(300 0) scale(-1 1)">${wing}</g></g><g class="border-layer strong-glow">${circle(63,`stroke="${grad}" stroke-width="5"`)}<g class="rotor">${circle(70,'stroke="var(--c1)" stroke-width="1.5" stroke-dasharray="22 16 3 12"')}</g></g>`,front:`<g class="decoration-layer">${particles()}<g fill="#ffd296">${[70,105,190,228].map((x,i)=>`<path class="ember" style="--delay:-${i}s" d="m${x} 204 3-7 3 7-3 4z"/>`).join('')}</g>${star(150,59,7)}</g>` };
    }
    if(c.id==='reactor') return {
      back:`<g class="border-layer strong-glow"><g class="rotor quick">${circle(65,'stroke="var(--c1)" stroke-width="5" stroke-dasharray="83 23 13 17"')}${circle(74,'stroke="var(--c2)" stroke-width="2" stroke-dasharray="10 26"')}<rect x="143" y="60" width="14" height="7" rx="2" fill="var(--c1)"/></g><g class="rotor reverse">${circle(81,'stroke="var(--c2)" stroke-width="1.5" stroke-dasharray="110 60"')}</g></g>`,
      front:`<g class="decoration-layer strong-glow"><g class="shimmer" fill="none" stroke="var(--c1)" stroke-width="2.5"><path class="stream" stroke-dasharray="24 5 34 8" d="m73 66-20 30 16 9-29 37 19-1-8 31m173-84 19 19-16 12 25 36-16-3 8 28"/><path d="m87 204-13 13 23-3-5 20m98-180 12-11-4 24" stroke="var(--c2)"/></g>${particles()}</g>`};
    if(c.id==='koi') {
      const fish=`<path d="M146 49c-12-12-7-24 0-34 10 9 14 22 4 33l-1 6 8 8-8-2-7 2z" fill="${grad}"/><path d="m145 26-7 4 5 5m8-2 8-3-6 10" fill="var(--c1)"/><path d="m148 19-3 17 4 9" fill="none" stroke="#fff2d4" stroke-width="2"/><circle cx="144" cy="22" r="1.5" fill="#283b41"/>`;
      return {back:`<g class="border-layer soft-glow">${circle(64,'stroke="var(--c1)" stroke-width="2"')}<g class="breathing">${circle(78,'stroke="var(--c1)" stroke-opacity=".35" stroke-width="1"')}${circle(90,'stroke="var(--c1)" stroke-opacity=".18" stroke-width="1"')}</g><g class="rotor slow">${circle(71,'stroke="var(--c2)" stroke-width="2" stroke-dasharray="15 112"')}</g></g>`,front:`<g class="decoration-layer soft-glow"><g class="rotor">${fish}<g transform="rotate(180 150 140)">${fish}</g></g><g class="particles" fill="none" stroke="var(--c1)"><circle cx="60" cy="143" r="4"/><circle cx="221" cy="189" r="3"/><circle cx="202" cy="57" r="5"/></g>${star(88,74,4)}${star(234,141,4)}</g>`};
    }
    if(c.id==='crown') {
      const shard=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="m0-13 8 13-8 13-8-13z" fill="${grad}" stroke="#edddff" stroke-width=".7"/><path d="M0-13v26M-8 0H8" stroke="#faf5ff" stroke-opacity=".7" stroke-width=".6"/></g>`;
      return {back:`<g class="border-layer soft-glow"><path d="m150 65 48 18 28 57-28 56-48 20-48-20-28-56 28-57z" fill="none" stroke="${grad}" stroke-width="4"/>${circle(64,'stroke="var(--c1)" stroke-opacity=".55" stroke-width="1"')}<g class="rotor slow">${shard(77,138,.65)}${shard(224,139,.65)}${shard(150,216,.5)}</g></g>`,front:`<g class="decoration-layer strong-glow"><g class="levitate"><path d="m111 67-6-28 23 17 22-32 22 32 23-17-7 28z" fill="${grad}" stroke="#fceaff" stroke-width="1.5"/><path d="M114 72h72" stroke="var(--c1)" stroke-width="4" stroke-linecap="round"/>${shard(150,52,.5)}${shard(107,35,.27)}${shard(193,35,.27)}</g>${particles()}</g>`};
    }
    if(c.id==='void') return {back:`<g class="border-layer"><g class="rotor slow">${circle(72,'stroke="var(--c1)" stroke-opacity=".24" stroke-width="10"')}${circle(68,'stroke="var(--c2)" stroke-width="2" stroke-dasharray="50 30 100 60"')}</g><g class="breathing strong-glow">${circle(60,'stroke="var(--c1)" stroke-width="4"')}</g></g><g class="decoration-layer"><g transform="rotate(-24 150 140)"><ellipse cx="150" cy="140" rx="113" ry="34" fill="none" stroke="var(--c2)" stroke-opacity=".2" stroke-width="10"/><ellipse cx="150" cy="140" rx="111" ry="32" fill="none" stroke="var(--c1)" stroke-width="2"/></g></g>`,front:`<g class="decoration-layer"><g transform="rotate(-24 150 140)" class="strong-glow"><path d="M39 140a111 32 0 0 0 222 0" fill="none" stroke="var(--c2)" stroke-width="4"/><path class="stream" d="M39 140a111 32 0 0 0 222 0" fill="none" stroke="#ffe0fc" stroke-width="1.5" stroke-dasharray="22 16"/></g><g class="rotor slow">${particles()}${star(110,46,5)}${star(228,199,6)}</g></g>`};
    const flower=(x,y,s)=>`<g transform="translate(${x} ${y}) scale(${s})"><g class="shimmer">${[0,72,144,216,288].map(a=>`<ellipse cx="0" cy="-7" rx="4" ry="8" transform="rotate(${a})" fill="${grad}" stroke="#ffd3e8" stroke-width=".5"/>`).join('')}<circle r="3.5" fill="#fff0b7"/></g></g>`;
    const butterfly=`<g class="levitate"><path d="M0 2C-27-24-26 12-5 13c-12 17 3 16 5 4 2 12 17 13 5-4 21-1 22-37-5-11" fill="${grad}" stroke="#ffe7ef" stroke-width="1"/><path d="M0 1v17m0-13-4-5m4 5 4-5" stroke="#ffe7ef" stroke-width="1.5"/></g>`;
    return {back:`<g class="border-layer soft-glow">${circle(66,'stroke="var(--c1)" stroke-width="2"')}<path d="M83 149c-25-32 10-55 33-68m101 58c21 37-5 54-29 69" fill="none" stroke="#a9d5b5" stroke-width="2"/>${[[103,94,.7],[85,142,.65],[106,192,.85],[187,87,.8],[214,130,.6],[192,189,.7]].map(p=>flower(...p)).join('')}</g>`,front:`<g class="decoration-layer soft-glow"><g transform="translate(204 55) rotate(20)">${butterfly}</g><g transform="translate(63 188) rotate(-30) scale(.65)">${butterfly}</g>${particles()}<g class="particles" fill="var(--c1)"><ellipse cx="74" cy="85" rx="3" ry="7" transform="rotate(-35 74 85)"/><ellipse cx="221" cy="216" rx="3" ry="7" transform="rotate(40 221 216)"/></g></g>`};
  }
  function art(c) {
    const uid=`cosmetic-${++serial}`;
    const {back,front}=layers(c,uid);
    return `<svg class="art" viewBox="0 0 300 280" style="--c1:${c.c1};--c2:${c.c2}" aria-hidden="true" focusable="false"><defs><linearGradient id="${uid}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c.c1}"/><stop offset=".45" stop-color="#fff1db"/><stop offset="1" stop-color="${c.c2}"/></linearGradient></defs>${back}${fox}${front}</svg>`;
  }
  const gallery=document.getElementById('gallery');
  gallery.innerHTML=concepts.map((c,i)=>`<button class="concept" type="button" data-id="${c.id}" style="--c1:${c.c1};--c2:${c.c2}" aria-pressed="${i===0}" aria-label="Preview ${c.name}"><span class="stage">${art(c)}</span><span class="concept-label"><span class="concept-title">${c.name}</span><span class="selected-dot" aria-hidden="true">✓</span><span class="concept-description">${c.description}</span><span class="pair"><span>${c.border}</span><span>${c.decoration}</span></span></span></button>`).join('');
  function updateContext() {
    ['profile-avatar','feed-avatar','voice-avatar'].forEach(id=>{ document.getElementById(id).innerHTML=art(selected); });
    document.getElementById('selected-name').textContent=selected.name;
    gallery.querySelectorAll('.concept').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.id===selected.id)));
  }
  gallery.addEventListener('click',event=>{
    const button=event.target.closest('.concept');
    if(!button)return;
    selected=concepts.find(c=>c.id===button.dataset.id);
    updateContext();
  });
  motion.addEventListener('click',()=>{
    const paused=root.classList.toggle('paused');
    motion.textContent=paused?'Play animation':'Pause animation';
    motion.setAttribute('aria-pressed',String(paused));
  });
  ['borders','decorations'].forEach(id=>document.getElementById(id).addEventListener('change',event=>root.classList.toggle(`hide-${id}`,!event.target.checked)));
  document.getElementById('energy').addEventListener('change',event=>{
    root.classList.remove('energy-calm','energy-extra');
    if(event.target.value!=='full')root.classList.add(`energy-${event.target.value}`);
  });
  document.getElementById('surface').addEventListener('click',event=>{
    const light=root.classList.toggle('light-stages');
    event.target.textContent=light?'Dark backdrop':'Light backdrop';
    event.target.setAttribute('aria-pressed',String(light));
  });
  function syncMotionPreference() {
    root.classList.toggle('system-reduced',reduced.matches);
    motion.disabled=reduced.matches;
    motion.textContent=reduced.matches?'Reduced motion on':root.classList.contains('paused')?'Play animation':'Pause animation';
  }
  reduced.addEventListener('change',syncMotionPreference);
  // Stop decoration loops while the preview is in a background tab.
  document.addEventListener('visibilitychange',()=>root.classList.toggle('system-reduced',document.hidden||reduced.matches));
  syncMotionPreference();
  updateContext();
})();
