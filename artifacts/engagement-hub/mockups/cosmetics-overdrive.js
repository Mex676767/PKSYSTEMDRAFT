(() => {
  const root=document.getElementById('cosmetics-studio');
  const concepts=[
    {id:'dragon',name:'Dragonstorm',c1:'#70f7e0',c2:'#a987ff',description:'A coiling celestial dragon wrapped in flowing lightning.',border:'Storm sigil',decoration:'Celestial dragon'},
    {id:'seraph',name:'Celestial Seraph',c1:'#ffe09a',c2:'#ff9fcf',description:'Six radiant wings, a jeweled crest, and ascending light.',border:'Divine halo',decoration:'Six-wing seraph'},
    {id:'oni',name:'Crimson Oni',c1:'#ff6b71',c2:'#ffb54f',description:'Flaming horns, molten armor, and a rising inferno.',border:'Molten armor',decoration:'Oni horns'},
    {id:'nova',name:'Hypernova',c1:'#ff91ef',c2:'#66e8ff',description:'A rainbow starburst with prismatic rings and comet trails.',border:'Spectrum core',decoration:'Supernova rays'},
    {id:'kitsune',name:'Nine-tail Mirage',c1:'#ffc5ee',c2:'#b897ff',description:'Nine flowing spirit tails with floating kitsune masks.',border:'Spirit seal',decoration:'Nine-tail spirits'},
    {id:'abyss',name:'Abyssal Monarch',c1:'#68e9ff',c2:'#7290ff',description:'Bioluminescent tentacles, a coral crown, and tidal rings.',border:'Tidal crown',decoration:'Leviathan arms'},
    {id:'fortune',name:'Gilded Fortune',c1:'#ffda74',c2:'#ff8dba',description:'Spinning gold, floating royal cards, and a diamond crest.',border:'Royal filigree',decoration:'Fortune orbit'},
    {id:'arcane',name:'Arcane Eclipse',c1:'#ceaeff',c2:'#77e2ff',description:'A rotating spell circle with a crescent and levitating tomes.',border:'Runic gate',decoration:'Astral spellcraft'},
  ];
  let serial=0,selected=concepts[0],burstTimer;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const motion=document.getElementById('motion');
  const burst=document.getElementById('burst');
  const circle=(r,attrs='')=>`<circle ${attrs.includes('class=')?'':'class="orbit-line"'} cx="150" cy="140" r="${r}" ${attrs}/>`;
  const star=(x,y,s=5,color='var(--c1)')=>`<path d="M${x} ${y-s}Q${x} ${y} ${x+s} ${y}Q${x} ${y} ${x} ${y+s}Q${x} ${y} ${x-s} ${y}Q${x} ${y} ${x} ${y-s}" fill="${color}"/>`;
  const stars=()=>`<g class="particles extra-layer">${[[38,56],[255,71],[30,181],[274,164],[68,230],[232,235],[149,25],[199,261],[91,32],[288,104]].map(([x,y],i)=>`<g style="--delay:-${i*.31}s">${star(x,y,i%3+2)}<circle cx="${x+8}" cy="${y+12}" r="1.2" fill="var(--c2)"/></g>`).join('')}</g>`;
  const jewel=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="m0-10 7 10-7 11-7-11z" fill="var(--c2)" stroke="#fff2db" stroke-width=".8"/><path d="M0-10v21M-7 0H7" stroke="#fff2db" stroke-width=".5"/></g>`;
  const fox=`<g class="avatar-layer"><circle cx="150" cy="140" r="54" fill="#302341" stroke="#f2d3ff" stroke-opacity=".45" stroke-width="1.5"/><circle cx="150" cy="140" r="49" fill="#3d2a51"/><path d="m117 127-5-31 27 17M163 113l25-17-6 33" fill="#f89d57" stroke="#ffca87" stroke-width="2"/><path d="m119 116-3-12 15 11m42 0 11-11-2 13" fill="#5c3452"/><path d="M114 129q7-19 36-20 29 1 36 20l-9 28-27 19-27-19z" fill="#ee9453"/><path d="m115 134 35 22 35-22-8 23-27 19-27-19z" fill="#fff0d7"/><path d="m136 153 14 4 14-4-14 14z" fill="#3c2745"/><path d="m126 137 9 3m30 0 9-3" stroke="#392443" stroke-width="3" stroke-linecap="round"/><path d="m128 147 5 1m34 0 5-1" stroke="#fdab9b" stroke-width="3" stroke-linecap="round"/><path d="M150 166v4" stroke="#3c2745" stroke-width="2" stroke-linecap="round"/></g>`;
  function layers(c,u){
    const g=`url(#${u}-metal)`,a=`url(#${u}-aura)`,rainbow=`url(#${u}-rainbow)`;
    const standard=`${circle(61,`stroke="${g}" stroke-width="3"`)}${circle(66,'stroke="var(--c1)" stroke-opacity=".5" stroke-width="1"')}`;
    if(c.id==='dragon'){
      const body='M212 76C265 88 264 158 228 200C180 250 77 235 47 178C9 104 66 36 132 55';
      return {back:`<g class="decoration-layer strong-glow rock"><path d="${body}" fill="none" stroke="var(--c2)" stroke-width="17"/><path d="${body}" fill="none" stroke="${g}" stroke-width="11"/><path d="${body}" fill="none" stroke="#fff2db" stroke-width="2" stroke-dasharray="1 8"/><path d="m48 165-17 6 11-20-15-8 14-7-6-18 14 7m166 82 18 10-6-22 18-2-6-10 15-8-14-5" fill="var(--c1)"/><path d="m115 57 17-13-2 17 18-6-12 15" fill="${g}"/></g><g class="border-layer strong-glow">${standard}<g class="rotor slow">${circle(78,'stroke="var(--c2)" stroke-width="1.5" stroke-dasharray="12 28"')}</g></g>`,front:`<g class="decoration-layer strong-glow"><g class="rock"><path d="m207 88-21-19 10-19 20-3 19 17-6 21-13 9z" fill="${g}" stroke="#cafff6" stroke-width="1.5"/><path d="m198 54-7-23 16 15m11 4 10-23 3 31" fill="none" stroke="var(--c1)" stroke-width="3"/><path d="m197 69 18 1m2 8 12-5" stroke="#233349" stroke-width="3" stroke-linecap="round"/><path d="m216 86 16 16 15-1m-30-18-4 20-9 5" fill="none" stroke="#cafff6" stroke-width="1.5"/></g><path class="stream" d="m44 66-17 32 17 4-14 37m218 30 23 19-17 8 11 25" fill="none" stroke="#ddfffc" stroke-width="2" stroke-dasharray="25 8"/>${stars()}</g>`};
    }
    if(c.id==='seraph'){
      const wing=`<g class="fan">${[0,1,2].map(i=>`<g transform="rotate(${-i*20} 95 151)"><path d="M98 178C57 157 24 95 21 37C40 64 66 55 74 85C92 107 93 140 98 178z" fill="${g}" stroke="#fff4dd" stroke-width=".9"/><path d="M92 167C51 125 35 76 29 52M87 152C72 133 65 108 64 91M72 127l-22-2m33 20-22-3m-9-31-14-1" fill="none" stroke="#fff7df" stroke-opacity=".8" stroke-width="1.5"/></g>`).join('')}</g>`;
      return {back:`<g class="decoration-layer ornament" transform="translate(150 140) scale(.74) translate(-150 -140)">${wing}<g transform="translate(300 0) scale(-1 1)">${wing}</g></g><g class="border-layer strong-glow">${circle(62,`stroke="${g}" stroke-width="5"`)}<g class="rotor slow">${circle(74,'stroke="var(--c1)" stroke-width="1.5" stroke-dasharray="1 8"')}</g><g class="breathing">${circle(86,'stroke="var(--c1)" stroke-opacity=".4" stroke-width="1"')}</g></g>`,front:`<g class="decoration-layer strong-glow"><g class="rise"><ellipse cx="150" cy="38" rx="41" ry="9" fill="none" stroke="var(--c1)" stroke-width="3"/><ellipse cx="150" cy="38" rx="32" ry="5" fill="none" stroke="#fff5dc" stroke-width="1"/>${jewel(150,65,1.1)}${star(120,57,4)}${star(180,57,4)}</g><path d="m126 206 24 18 24-18-9 25-15 10-15-10z" fill="${g}" stroke="#fff1d1" stroke-width="1"/>${stars()}</g>`};
    }
    if(c.id==='oni'){
      const flame=`<g class="rise"><path d="M84 198C39 175 31 148 44 117C45 141 62 139 54 105C79 129 75 90 76 67C102 94 113 132 97 152z" fill="${g}" opacity=".8"/><path d="M82 181C55 152 64 137 69 125C66 151 86 138 87 117C98 142 96 161 82 181z" fill="#fff0a1"/></g>`;
      return {back:`<g class="decoration-layer strong-glow">${flame}<g transform="translate(300 0) scale(-1 1)">${flame}</g><g class="ripple extra-layer">${circle(82,'stroke="var(--c2)" stroke-width="2"')}</g></g><g class="border-layer ornament"><path d="m150 68 45 16 24 41-5 53-29 30-35 15-35-15-29-30-5-53 24-41z" fill="none" stroke="${g}" stroke-width="7"/><path d="m104 193 15 9-6 14m83-23-15 9 6 14M84 117l13-4m119 4-13-4" fill="none" stroke="#fff0bf" stroke-width="3"/></g>`,front:`<g class="decoration-layer strong-glow"><g class="rock"><path d="M111 96C77 76 83 42 65 22C101 34 119 67 121 92zM189 96C223 76 217 42 235 22C199 34 181 67 179 92z" fill="${g}" stroke="#ffeda4" stroke-width="1.4"/><path d="m75 39 12 26m137-26-12 26" stroke="#fff1c0" stroke-width="2"/></g><path d="m112 207 12-6 8 11 18-8 18 8 8-11 12 6-9 20h-58z" fill="${g}"/><path d="m137 218 13 6 13-6" fill="none" stroke="#551d3b" stroke-width="2"/>${stars()}</g>`};
    }
    if(c.id==='nova'){
      const rays=Array.from({length:12},(_,i)=>`<g transform="rotate(${i*30} 150 140)"><path d="m150 43-4-17 4-14 4 14z" fill="${rainbow}"/><path d="M150 49V31" stroke="#fff0ff" stroke-width="1.4"/></g>`).join('');
      return {back:`<g class="decoration-layer"><circle cx="150" cy="140" r="114" fill="${a}"/><g class="rotor slow ornament">${rays}</g><g class="rotor reverse"><path d="M65 57Q148 24 238 81M62 217Q151 253 240 199" fill="none" stroke="${rainbow}" stroke-width="3" stroke-dasharray="100 20"/></g></g><g class="border-layer strong-glow"><g class="rotor">${circle(67,`stroke="${rainbow}" stroke-width="8" stroke-dasharray="80 13"`)}</g><g class="rotor reverse">${circle(82,`stroke="${rainbow}" stroke-width="3" stroke-dasharray="20 8"`)}</g>${circle(59,'stroke="#fff0ff" stroke-width="1.5"')}<g class="ripple extra-layer">${circle(90,`stroke="${rainbow}" stroke-width="2"`)}</g></g>`,front:`<g class="decoration-layer ornament"><path class="comet" d="M24 75q36-44 87-47M270 226q-32 38-94 33" fill="none" stroke="${rainbow}" stroke-width="5" stroke-linecap="round" stroke-dasharray="37 130"/><g class="rotor slow">${star(53,147,10,'#fff0ff')}${star(245,134,10,'#fff0ff')}</g>${stars()}</g>`};
    }
    if(c.id==='kitsune'){
      const tails=Array.from({length:9},(_,i)=>`<g transform="rotate(${(i-4)*20} 150 201)"><path d="M151 217C110 178 129 126 148 67C181 114 174 175 151 217z" fill="${g}" stroke="#ffe4fc" stroke-width="1"/><path d="M145 82c-8 38-14 70 0 105" fill="none" stroke="#fff5fa" stroke-width="1.1" opacity=".8"/><path d="M149 68c-6 16-11 36-12 51 11-4 20-6 29-6-4-19-9-32-17-45z" fill="#fff0f8" opacity=".88"/></g>`).join('');
      const mask=`<path d="m-16 0-3-22 15 10 4-2 4 2 15-10-3 22-16 17z" fill="#ffedf8" stroke="var(--c2)" stroke-width="1"/><path d="m-13-3 8 4m10 0 8-4M-4 8h8m-16-19 3-5m18 5-3-5" stroke="#db4f9c" stroke-width="2"/><path d="m-3 5 3 3 3-3" fill="#9d4abb"/>`;
      return {back:`<g class="decoration-layer ornament fan">${tails}</g><g class="border-layer strong-glow">${standard}<g class="rotor slow">${circle(76,'stroke="var(--c2)" stroke-width="2" stroke-dasharray="40 20 1 12"')}</g></g>`,front:`<g class="decoration-layer ornament"><g transform="translate(58 171) rotate(-18)"><g class="rise">${mask}</g></g><g transform="translate(239 165) rotate(18)"><g class="rise" style="--delay:-2.5s">${mask}</g></g>${jewel(150,218,.8)}${stars()}</g>`};
    }
    if(c.id==='abyss'){
      const tentacles=['M94 168C67 117 50 74 36 107S80 212 38 195 16 140 26 127','M112 191C93 236 48 253 46 224S92 205 71 180','M127 194C111 232 85 272 62 252','M89 126C39 138 8 83 24 63S61 74 58 103'];
      const arms=tentacles.map((d,i)=>`<g class="rock" style="animation-delay:-${i}s"><path d="${d}" fill="none" stroke="var(--c2)" stroke-width="8" stroke-linecap="round"/><path d="${d}" fill="none" stroke="var(--c1)" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/></g>`).join('');
      return {back:`<g class="decoration-layer strong-glow">${arms}<g transform="translate(300 0) scale(-1 1)">${arms}</g></g><g class="border-layer strong-glow">${standard}<g class="ripple">${circle(81,'stroke="var(--c1)" stroke-width="1.5"')}</g><g class="rotor slow">${circle(70,'stroke="var(--c1)" stroke-width="2" stroke-dasharray="1 14"')}</g></g>`,front:`<g class="decoration-layer strong-glow"><g class="rise"><path d="m112 79-9-30 18 13 4-25 25 22 25-22 4 25 18-13-9 30z" fill="${g}" stroke="#c8f9ff" stroke-width="1"/>${jewel(150,55,.7)}</g><g class="particles" fill="none" stroke="var(--c1)"><circle cx="39" cy="161" r="3"/><circle cx="254" cy="91" r="5"/><circle cx="109" cy="246" r="3"/></g>${stars()}</g>`};
    }
    if(c.id==='fortune'){
      const coin=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><g class="coin"><circle r="10" fill="${g}" stroke="#fff0a0" stroke-width="1"/><circle r="7" fill="none" stroke="#976130" stroke-width=".6"/><path d="m0-5 4 5-4 5-4-5z" fill="#99612a"/></g></g>`;
      const card=(suit)=>`<rect x="-19" y="-29" width="38" height="58" rx="4" fill="#fff1de" stroke="#ffda80" stroke-width="1.4"/><text x="-13" y="-16" font-size="10" fill="#a74062" font-family="Georgia">A</text><text y="7" text-anchor="middle" font-size="24" fill="#a74062" font-family="Georgia">${suit}</text><path d="M10 21h4" stroke="#a74062" stroke-width="1.5"/>`;
      return {back:`<g class="decoration-layer ornament"><g transform="translate(58 118) rotate(-22)"><g class="rise">${card('♥')}</g></g><g transform="translate(243 124) rotate(22)"><g class="rise" style="--delay:-2s">${card('♦')}</g></g></g><g class="border-layer strong-glow">${circle(62,`stroke="${g}" stroke-width="5"`)}${circle(70,'stroke="var(--c1)" stroke-width="1.5" stroke-dasharray="2 6"')}<path d="M86 191q-11 35 37 20m91-20q11 35-37 20M93 93q-9-32 27-15m87 15q9-32-27-15" fill="none" stroke="var(--c1)" stroke-width="2"/></g>`,front:`<g class="decoration-layer ornament"><g class="rise"><path d="m120 64-7-25 22 13 15-24 15 24 22-13-7 25z" fill="${g}" stroke="#fff0ae" stroke-width="1"/>${jewel(150,49,.6)}</g><g class="rotor slow">${coin(150,236)}${coin(56,178,.8)}${coin(246,85,.8)}${coin(99,49,.7)}</g>${coin(128,232,.7)}${coin(174,230,.7)}${stars()}</g>`};
    }
    const glyphs=Array.from({length:12},(_,i)=>`<g transform="rotate(${i*30} 150 140)"><path d="m146 40 4-9 4 9-4 5zM150 31v16m-7-10h14" fill="none" stroke="var(--c1)" stroke-width="1"/></g>`).join('');
    const book=`<path d="M0 0q-14-10-29-6v31q17-2 29 7 12-9 29-7V-6Q14-10 0 0z" fill="#322950" stroke="var(--c1)" stroke-width="1.8"/><path d="M0 1v28m-23-27 17 4m-17 3 17 4m-17 3 17 4m12-14 17-4m-17 11 17-4m-17 11 17-4" fill="none" stroke="var(--c2)" stroke-width="1"/>`;
    return {back:`<g class="border-layer strong-glow"><g class="rotor slow">${circle(96,'stroke="var(--c1)" stroke-width="1"')}${circle(109,'stroke="var(--c1)" stroke-width="1"')}${glyphs}<path d="m150 50 78 135H72zm0 180L72 95h156z" fill="none" stroke="var(--c2)" stroke-width="1.2"/></g><g class="rotor reverse">${circle(78,'stroke="var(--c1)" stroke-width="2" stroke-dasharray="2 10"')}</g>${standard}</g>`,front:`<g class="decoration-layer ornament"><g class="rise"><path d="M173 11c-43 10-52 45-15 61-46 3-59-58 15-61z" fill="${g}" stroke="#eedeff" stroke-width=".8"/>${star(166,43,9,'#fff2ff')}</g><g transform="translate(64 215) rotate(-15)"><g class="rise">${book}</g></g><g transform="translate(238 211) rotate(15) scale(.75)"><g class="rise" style="--delay:-2s">${book}</g></g>${stars()}</g>`};
  }
  function art(c){
    const u=`overdrive-${++serial}`,l=layers(c,u);
    return `<svg class="art" viewBox="0 0 300 280" style="--c1:${c.c1};--c2:${c.c2}" aria-hidden="true" focusable="false"><defs><linearGradient id="${u}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c.c1}"/><stop offset=".48" stop-color="#fff1de"/><stop offset="1" stop-color="${c.c2}"/></linearGradient><linearGradient id="${u}-rainbow" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff7dc7"/><stop offset=".22" stop-color="#ffdc83"/><stop offset=".43" stop-color="#87ffb5"/><stop offset=".64" stop-color="#79e6ff"/><stop offset=".83" stop-color="#ae95ff"/><stop offset="1" stop-color="#ff88e9"/></linearGradient><radialGradient id="${u}-aura"><stop stop-color="${c.c1}" stop-opacity=".2"/><stop offset=".6" stop-color="${c.c2}" stop-opacity=".15"/><stop offset="1" stop-color="${c.c2}" stop-opacity="0"/></radialGradient></defs><g class="power-star">${l.back}${fox}${l.front}</g><g class="decoration-layer extra-layer">${circle(92,'class="power-ring" fill="none" stroke="var(--c1)" stroke-width="3"')}${circle(77,'class="power-ring" fill="none" stroke="var(--c2)" stroke-width="1" style="animation-delay:.15s"')}</g></svg>`;
  }
  const gallery=document.getElementById('gallery');
  gallery.innerHTML=concepts.map((c,i)=>`<button class="concept" type="button" data-id="${c.id}" style="--c1:${c.c1};--c2:${c.c2}" aria-pressed="${i===0}" aria-label="Preview ${c.name}"><span class="stage">${art(c)}</span><span class="concept-label"><span class="concept-title">${c.name}</span><span class="selected-dot" aria-hidden="true">✓</span><span class="concept-description">${c.description}</span><span class="pair"><span>${c.border}</span><span>${c.decoration}</span></span></span></button>`).join('');
  function update(){
    ['profile-avatar','feed-avatar','voice-avatar'].forEach(id=>document.getElementById(id).innerHTML=art(selected));
    document.getElementById('selected-name').textContent=selected.name;
    gallery.querySelectorAll('.concept').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.id===selected.id)));
  }
  gallery.addEventListener('click',event=>{const b=event.target.closest('.concept');if(!b)return;selected=concepts.find(c=>c.id===b.dataset.id);update();});
  motion.addEventListener('click',()=>{const paused=root.classList.toggle('paused');motion.setAttribute('aria-pressed',String(paused));motion.textContent=paused?'Play animation':'Pause animation';burst.disabled=paused||reduced.matches;});
  burst.addEventListener('click',()=>{
    if(reduced.matches||root.classList.contains('paused'))return;
    clearTimeout(burstTimer);
    root.classList.remove('power-up');
    void root.offsetWidth;
    root.classList.add('power-up');
    burstTimer=setTimeout(()=>root.classList.remove('power-up'),2100);
  });
  ['borders','decorations'].forEach(id=>document.getElementById(id).addEventListener('change',event=>root.classList.toggle(`hide-${id}`,!event.target.checked)));
  document.getElementById('energy').addEventListener('change',event=>{root.classList.remove('energy-calm','energy-extra');if(event.target.value!=='full')root.classList.add(`energy-${event.target.value}`);});
  document.getElementById('surface').addEventListener('click',()=>{const light=root.classList.toggle('light-stages');const button=document.getElementById('surface');button.textContent=light?'Dark backdrop':'Light backdrop';button.setAttribute('aria-pressed',String(light));});
  function syncMotion(){
    root.classList.toggle('system-reduced',reduced.matches||document.hidden);
    motion.disabled=reduced.matches;
    motion.textContent=reduced.matches?'Reduced motion on':root.classList.contains('paused')?'Play animation':'Pause animation';
    burst.disabled=reduced.matches||root.classList.contains('paused');
  }
  reduced.addEventListener('change',syncMotion);
  document.addEventListener('visibilitychange',syncMotion);
  syncMotion();update();
})();
