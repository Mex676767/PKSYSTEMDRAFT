import { createRoot } from "react-dom/client";
import { useState } from "react";
import { UserAvatar } from "../src/components/user-avatar";
import { VoiceParticipantAvatar } from "../src/components/voice-participant-avatar";
import { ANIMATED_COSMETIC_SETS } from "../src/lib/animated-cosmetics";
import { ACCESSORY_KEYS, BORDER_KEYS } from "../src/lib/cosmetics";
import "../src/index.css";

const user = { name: "Alex", initials: "AL", color: "bg-primary" };
const variants = [
  { name: "Plain", accessory: null, border: null },
  ...ACCESSORY_KEYS.map(accessory => ({ name: accessory, accessory, border: "cosmic-orbit" })),
  ...BORDER_KEYS.map(border => ({ name: border, accessory: "angel-wings", border })),
  ...ANIMATED_COSMETIC_SETS.map(set => ({ name: set.name, accessory: set.accessoryKey, border: set.borderKey })),
];
const oni = ANIMATED_COSMETIC_SETS.find(set => set.id === "overdrive-oni")!;
const examples = [variants[0], { name: "Legacy", accessory: "angel-wings", border: "sakura-bloom" }, { name: "Crimson Oni", accessory: oni.accessoryKey, border: oni.borderKey }];
const contexts = [{ size: 20, className: "w-5 h-5 text-[9px]" }, { size: 32, className: "w-8 h-8 text-xs" }, { size: 44, className: "w-11 h-11 text-sm" }, { size: 64, className: "w-16 h-16 text-xl" }];

function LayoutRegression() {
  const [selected, setSelected] = useState(2);
  return <main className="p-4 max-w-6xl mx-auto space-y-6">
    <h1 className="text-2xl font-bold">Avatar layout check</h1>
    <div className="flex flex-wrap gap-3" data-nav-samples>
      {examples.map(example => <button key={example.name} className="flex h-10 items-center gap-2 p-0.5 border rounded-full" aria-label={example.name}>
        <UserAvatar user={user} {...example} className="w-8 h-8" /><span className="text-xs">⌄</span>
      </button>)}
    </div>
    <button className="border rounded-lg px-3 py-2" onClick={() => setSelected(value => (value + 1) % examples.length)}>Change first card cosmetic</button>
    <div className="grid sm:grid-cols-3 gap-4" data-card-samples>
      {[examples[selected], examples[0], examples[1]].map((example, index) => <article key={index} className="border-2 rounded-xl p-5 h-[23rem] flex flex-col min-w-0">
        <header className="flex items-center gap-2.5 mb-4 min-w-0">
          <UserAvatar user={user} {...example} className="w-11 h-11" />
          <div className="min-w-0"><p className="font-bold truncate">@{index === 0 ? "Mexha".repeat(40) : ["", "Eric", "Ken"][index]}</p><p className="text-xs text-muted-foreground">Team member</p></div>
        </header>
        <div data-card-content className="flex-1 border-t pt-3 text-sm">Short-term<p className="text-xs text-muted-foreground">Goal content stays aligned.</p></div>
      </article>)}
    </div>
    <div className="flex -space-x-3" data-stack-sample>{examples.map(example => <UserAvatar key={example.name} user={user} {...example} className="w-10 h-10 ring-2 ring-background" />)}</div>
    <div className="flex gap-4" data-voice-samples>{examples.map(example => <VoiceParticipantAvatar key={example.name}
      participant={{ id: example.name, username: "Alex", muted: true, deafened: false, streaming: true }}
      isMe={false} isSpeaking isMuted isDeafened={false} myProfile={null}
      directoryEntry={{ id: example.name, username: "Alex", department: null, role: null, avatar_url: null, active_title: null, last_seen_at: null, active_border: example.border, active_accessory: example.accessory }}
    />)}</div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {variants.map(variant => <section key={variant.name} data-variant={variant.name} className="border rounded-lg p-3 min-w-0">
        <h2 className="text-xs truncate mb-3">{variant.name}</h2>
        <div className="flex items-center gap-4">{contexts.map(context => <div key={context.size} data-expected-size={context.size}>
          <UserAvatar user={user} {...variant} className={context.className} />
        </div>)}</div>
      </section>)}
    </div>
    <div className="flex justify-center"><UserAvatar user={user} {...examples[2]} className="w-9 h-9 sm:w-12 sm:h-12" /></div>
  </main>;
}

createRoot(document.getElementById("root")!).render(<LayoutRegression />);
