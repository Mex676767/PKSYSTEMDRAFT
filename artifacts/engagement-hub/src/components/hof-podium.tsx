import { UserAvatar } from "@/components/user-avatar";
import { initialsForUsername, colorForId } from "@/hooks/use-auth";
import type { HofPodiumEntry } from "@/hooks/use-hall-of-fame";
import { cn } from "@/lib/utils";

const places = ["", "Monthly champion", "Second place", "Third place"];
const distinction = ["", "Gold distinction", "Silver distinction", "Bronze distinction"];

function ChampionCrown() {
  return (
    <svg className="hof-celestial-crown" viewBox="0 0 60 44" aria-hidden="true">
      <path d="m7 12 10 10L30 5l13 17 10-10-6 24H13z" fill="currentColor" stroke="#fff0c4" />
      <path d="M14 40h32M17 32h26" fill="none" stroke="#e4b654" strokeWidth="3" />
      <circle cx="7" cy="10" r="3" fill="#ffdfa0" />
      <circle cx="30" cy="4" r="3" fill="#ffdfa0" />
      <circle cx="53" cy="10" r="3" fill="#ffdfa0" />
    </svg>
  );
}

function CelestialMap() {
  const points = [[180, 170], [256, 220], [207, 330], [110, 285], [820, 170], [744, 220], [793, 330], [890, 285], [340, 90], [500, 125], [660, 90]];
  return (
    <svg className="hof-celestial-map" viewBox="0 0 1000 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth=".7">
        <circle cx="500" cy="375" r="285" />
        <circle cx="500" cy="375" r="270" strokeDasharray="1 12" />
        <path d="M180 170 256 220 207 330 110 285 180 170M820 170 744 220 793 330 890 285 820 170M340 90 500 125 660 90M400 50 500 125 600 50" />
      </g>
      <g fill="currentColor">{points.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" />)}</g>
    </svg>
  );
}

type DepartmentPodiumProps = {
  department: string;
  category: string;
  entries: HofPodiumEntry[];
  monthLabel?: string;
};

export function DepartmentPodium({ department, category, entries, monthLabel }: DepartmentPodiumProps) {
  return (
    <section aria-label={`${department} ${category} podium`} className="hof-celestial-shell">
      <CelestialMap />
      <div className="hof-celestial-arch" aria-hidden="true" />
      <header className="hof-celestial-head">
        <p>✦ Monthly KPI spotlight</p>
        <h2>{department} · {monthLabel}</h2>
        <span>Celebrating this month&apos;s standout performers</span>
        <div className="hof-celestial-tags" aria-label="Award details">
          <b>{department}</b><b>{category}</b>{monthLabel && <b>{monthLabel}</b>}
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="relative z-10 py-24 text-center text-muted-foreground">No winners selected for this category this month.</p>
      ) : (
        <div className="hof-celestial-scroll">
          <div className="hof-celestial-podium">
            {[2, 1, 3].map((rank) => {
              const entry = entries.find((person) => person.rank === rank);
              const winner = rank === 1;
              return (
                <article key={rank} data-rank={rank} className={cn("hof-celestial-place", winner && "is-winner")}>
                  {entry ? (
                    <>
                      <div className="hof-celestial-avatar-stage">
                        {winner && <ChampionCrown />}
                        <UserAvatar
                          user={{ name: entry.username ?? "Team member", initials: initialsForUsername(entry.username ?? "?"), color: colorForId(entry.user_id) }}
                          photoUrl={entry.avatar_url}
                          border={entry.active_border}
                          accessory={entry.active_accessory}
                          reserveSpace={false}
                          className={cn("hof-celestial-avatar", winner && "is-winner")}
                        />
                      </div>
                      <h3>{entry.username ?? "Team member"}</h3>
                      <p className="hof-celestial-place-name">{places[rank]}</p>
                      <p className="hof-celestial-achievement">{entry.achievement}</p>
                    </>
                  ) : (
                    <div className="hof-celestial-unclaimed"><span>{places[rank]}</span><b>Unclaimed</b></div>
                  )}
                  <div className="hof-celestial-divider" aria-hidden="true"><i />✧<i /></div>
                  <strong className="hof-celestial-rank">0{rank}</strong>
                  <span className="hof-celestial-distinction">{distinction[rank]}</span>
                </article>
              );
            })}
            <div className="hof-celestial-plinth" aria-hidden="true" />
          </div>
        </div>
      )}
      <p className="hof-celestial-dedication">✦ &nbsp; Celebrating excellence, together &nbsp; ✦</p>
    </section>
  );
}
