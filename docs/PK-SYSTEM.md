# PK / Challenge System: product requirements

Source: the boss's **PK Mechanism Handbook**, as briefed on 24 Sep 2026. This is
the persistent product context for all work on the Challenge / PK system
(`artifacts/engagement-hub/src/pages/challenges.tsx` today). Treat the current
challenge page as the prototype and evolve it toward this; don't rebuild what
already works.

## The one-line version

A complete internal competition system (a "Battle Arena"), not just a
challenge page. The full loop:

Create → negotiate / accept → superior approval → active competition →
progress updates with evidence → result verification → winner → **winner
playbook** → public settlement → PK points → leaderboard → playbook library.

The output isn't only "who won?" but **"what did the winner do differently?"**,
captured as reusable knowledge.

## Purpose

Healthy competition that raises motivation and measurable performance, is
visible and exciting, is fair across performance levels (rewards improvement,
not just natural strength), recognises strong performers, and turns each
winner's strategy into a playbook library.

## Participants

- Everyone, from day one. Leaders can compete too, not just referee.
- **Same department only** for now (cross-department is out of scope).
- Ranks: JNR, SNR, ATL, TL and higher (see Admin → Roles; rank order is managed there).

## Challenge types and limits

- 1v1 PK, Team PK, Employee vs Upline PK.
- Max active per person: 3 × 1v1, 1 × Team, 1 × vs Upline, **5 total**. System-enforced.

## Launch methods

- **Open**: no opponent chosen; creator sets all terms up front; listed publicly
  to the same department; first valid acceptor becomes the opponent and accepts
  the terms as posted; auto-expires after ~7 days with no taker.
- **Named**: challenge a specific person, who can **Accept / Counter-propose /
  Decline**. Max **2** counter-proposal rounds, then it's cancelled. Declining is
  fine; nothing is forced.

## Formats and scoring

**Head-to-Head** (both compete; normally one winner, one loser):
- **Absolute**: similar starting points; higher wins (or lower, for reverse
  metrics like response time or errors).
- **Improvement**: same metric, very different baselines; compare each person's
  gain over their own baseline (A 10→18 = +8 beats B 30→34 = +4).
- **Completion rate**: different circumstances; each has their own target;
  compare % achieved (A 18/20 = 90% beats B 32/40 = 80%).
- The calculation must be fixed and visible before the start.

**Self-Declaration** (only the initiator performs): "I'll achieve X within Y."
The acceptor bets they won't. Target met → initiator wins; missed → acceptor
wins. Needs especially clear target, measurement method and time, proof method,
and a witness/approver if required.

## Metrics

Anything quantifiable, calculable and verifiable. Retention/VIP: total deposits
from assigned players, active depositors, redeposit rate, reactivations, VIP
upgrades. Other teams: first/average response time, errors, chats handled,
ratings, deposit success rate, withdrawal processing time, on-time login, task
completion. Personal: courses, pages read, exercise, steps, attendance.
**Targets must represent improvement**: never a target worse than current performance.

## Create form (progressive disclosure; don't show everything at once)

Method (open/named) · format (head-to-head/self-declaration) · type
(1v1/team/vs upline) · metric + calculation definition · direction
(higher/lower wins) · scoring (absolute/improvement/completion) · baselines ·
targets · winning target · period (start, end) · update frequency · reward ·
penalty · PK Money amount · proof method · tiebreaker · opponent · department ·
approving superior · compliance agreement.
Improvement makes baselines required; completion rate makes both targets
required; self-declaration makes proof/measurement fields prominent.

## Approval

Both agree → submit for approval → **superior** reviews → approved → active.
The approver is based on the highest-ranked participant: generally **one level
above them and at least ATL**. They check the metric is measurable, it's fair,
targets and stakes are reasonable, PK Money is within limits, nobody is over
their active-PK limit, and penalties are appropriate.
Roles: participant, upline/approver, TL/manager, mechanism owner/admin.

## Active challenge

Should feel like an arena, not an HR record: VS layout (avatars, names, rank,
department), type, format, metric, current scores, target, completion %, who
leads and by how much, time remaining, status, reward, penalty, dates, update
history, proof, comments, reactions, timeline, "Update score", and "Settle"
when eligible.

## Progress updates

- Participants update **only their own** score.
- Cadence: weekly PK updates daily; monthly PK every Monday; long PKs at least
  weekly or as agreed.
- Each update: value, timestamp, proof screenshot, optional comment.
  **Keep the full history** (Day 1: 3, Day 2: 6, …), not just the latest.
- Missed updates: 1st reminder, 2nd recorded warning, 3rd violation (automation can come later).

## Settlement

- **Early settlement**: reaching the agreed winning target early lets a
  participant request settlement (after verification), so they can start the next PK sooner.
- **No quitting** once approved and started; stopping updates or refusing
  settlement can be a violation. Special cases (resignation, transfer,
  major data/system failure, customer pool change, emergency) **terminate**
  the PK instead of counting as quitting.
- Flow: ends → final data verified → winner determined → **winner submits
  playbook** → upline confirms → reward/penalty done → points → leaderboard →
  archived → playbook added to library. Settled PKs become history, never disappear.

## Rewards, penalties, PK Money

- Rewards and penalties must be agreed by both before the start (PK Money,
  food/drinks, small gifts, tasks, privileges, fun or ceremonial penalties,
  agreed physical penalties). Nothing can be imposed on someone.
- PK Money monthly allowance (not per match): JNR/SNR USD 50, ATL/TL USD 100,
  above TL USD 200. Track allowance / used / remaining; block going over. A
  match's stake is capped by the lower-ranked participant's limit.

## PK points and champions

- Win **+3**, loss **−1**, completed match **+0.5** (winner +3.5, loser −0.5).
  Can go negative. **3-month periods**, then reset.
- **PK King / Queen** per department per period: highest points; ties share.
  Show rank, points, wins, losses, completed, streak, current champion,
  historical champions.
- Leaderboard (prominent): rank, user, department, points, W, L, completed,
  win %, streak, played.

## Winner Playbook (core, not optional)

Before settlement the winner answers:
1. **What did you do extra?** Concrete actions ("contacted 10 extra dormant
   players a day, prioritising past depositors over RM1,000", not "worked harder").
2. **Which action worked best, and why?**
3. **Can others copy it? What should they watch out for?** Preconditions,
   risks, limits, things to avoid, who it suits.

No meaningful playbook means no settlement, no points and no reward. It's part
of the settlement workflow. All settled PKs + playbooks go into a searchable
**Playbook Library** (by metric, employee, department, type, date, winner).

## Social

Comments, emoji reactions, public progress, challenge and winner
announcements, leaderboards, streak indicators. Keep it alive, not a table app.

## Phases

- **Phase 1 (core)**: creation; named + open; head-to-head + self-declaration;
  accept / counter / decline; approval; arena cards; progress updates with
  history and proof; result; settlement; basic points; leaderboard; PK
  King/Queen; winner playbook; playbook library.
- **Phase 2 (gamification)**: win-streak bonus (one loss resets); bounty on 3+
  streaks (bonus for beating them); revenge match (with limits).
- **Phase 3 (spectators)**: predict winners with **virtual honor points, never
  money**; odds; prediction history; oracle leaderboard.

## Admin / management (eventually)

Approvals, permissions, ranks, departments, limits, PK Money limits, disputes,
violations, bans, settlement verification, termination, score audit, playbook
review, leaderboard periods, King/Queen, history, config. Never shown to normal employees.

## Audit

Keep original terms, every counter-proposal, acceptance, approval, score
updates, evidence, result, playbook, settlement and points. Once official,
terms never change silently; pre-activation changes are traceable.

## Suggested structure (adapt, don't copy blindly)

Battle Arena (active, open, detail) · Issue challenge · My PK (active,
awaiting response, awaiting approval, completed, history) · Leaderboard (dept,
King/Queen, streaks) · Playbook (search, filters) · Admin (approvals, users,
violations, disputes, settings, match management).

Statuses to consider: draft, awaiting opponent, counter-proposal, awaiting
confirmation, awaiting approval, scheduled, active, settlement requested,
awaiting playbook, awaiting verification, settled, cancelled, terminated, violation.

## Principles

- **Exciting**: VS layouts, progress bars, gaps, countdowns, leaderboards,
  streaks, champion badges.
- **Fair**: absolute, improvement and completion rate stay distinct. Never
  assume "highest number wins".
- **Transparent**: everyone sees the terms, the win condition, progress,
  stakes, evidence and who approved.
- **Knowledge sharing**: the playbook is a core reason the system exists.
- **Customer experience first**: never encourage poaching customers, abusing
  bonuses, manipulating entitlements, ignoring customer needs or inflating metrics.

## Working method

When changing the PK system, classify work as EXISTING / CHANGE NOW / BUILD
NOW / BUILD LATER / ADMIN-BACKEND / OPTIONAL UX, prioritise P0–P3, prefer the
smallest change that gets Phase 1 working, and don't over-engineer.

## Current system baseline (as of 24 Sep 2026)

- `challenges` table: creator_id, opponent_id, topic, description, reward,
  punishment, status (pending / active / completed / declined), score_creator,
  score_opponent, winner_id, starts_at, ends_at.
- RPCs: create_challenge, respond_challenge (accept/decline), update_challenge_score
  (overwrites own score; no history), complete_challenge (either participant;
  higher score wins), cancel_challenge, delete_challenge.
- UI: Battle Arena page with awaiting-response / pending / active / history
  lists, VS-style cards, upline/downline label from role rank, progress photos,
  reactions, comments, `challenge` notifications and push.
- Related systems already in place: admin-managed roles (ranked) and
  departments; reward points ledger guarded so points only come from missions
  and admins; missions (challenge activity deliberately not tracked yet);
  notifications + push; SearchableSelect for all dropdowns.

## Decisions (confirmed 24 Sep 2026)

| Question | Decision |
|---|---|
| PK points vs reward points | **Separate.** PK points are leaderboard-only (can go negative, reset each period) and never touch the reward-points ledger, which carries money value. |
| PK Money | **Tracked only.** The site records stakes, monthly allowance, used and remaining, and who owes whom; cash changes hands outside the site. |
| Team PK | **In Phase 1**, as the handbook says. |
| vs Upline | A 1v1 against someone more senior. Workable for the MVP. |
| Evidence | **Required on every score update.** |
| Leaderboard period | **Calendar quarters** (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec). The handbook doesn't specify. |

## Working defaults (not in the handbook; change here if they're wrong)

- **Team PK:** 2 to 5 people per side, same department, both sides the same size.
  The creator names both teams, and every member must accept the terms (a
  penalty can't be imposed on anyone). The opposing captain can counter-propose.
  Each member updates their own score. Team result:
  absolute = sum of members' values; improvement = sum of each member's gain
  over their own baseline; completion rate = team total ÷ team total target.
  Team PKs are named, not open, in Phase 1.
- **Open challenges** are 1v1 only in Phase 1.
- **Self-declaration** is 1v1 only: one declarer, one acceptor.
- **1v1 vs vs Upline:** a 1v1 between two different ranks counts as vs
  Upline (for both people's limits); same rank counts as 1v1.
- **Active-PK limits** count challenges awaiting approval as well as active
  ones, so nobody can queue up more than their limit.
- **Approver:** anyone in the same department whose rank is at least one level
  above the most senior participant, and at least ATL, who isn't a participant.
  Admins can always approve. If nobody qualifies, it goes to admins.
- **PK Money month:** a stake counts against the month the PK starts in.
  "Above TL" roles get USD 200; ATL/TL USD 100; everyone else USD 50.
- **Improvement rule:** every target must beat the person's baseline (higher
  for higher-wins metrics, lower for lower-wins).

## Build status

- **Milestones 1 and 2 (built):** migrations `0030`–`0038` in `artifacts/engagement-hub/supabase/migrations`, the `/challenges` page with Arena, My PKs, To approve and Old challenges tabs, the create/counter wizard (`src/components/pk/pk-wizard.tsx`), and the detail page at `/challenges/:id` (`src/pages/pk-detail.tsx`). Covers named and open challenges, counter-proposals, team and self-declaration formats, superior approval, limit and PK Money checks, score updates that need proof, the timeline and the terms history.
- **Milestone 3 (built):** migrations `0040`–`0043`. Settle at the end date (or early once a side hits the winning target; self-declaration at 100%), scores lock, the winner (captain for teams) writes the 3-question playbook (40+ characters each), an upline confirms (or sends the playbook back, applies the tiebreaker on a draw, or reopens the scores). Confirming gives PK points (win +3.5, loss −0.5, draw +0.5) into `pk_points` for the calendar quarter. Leaderboard tab with King/Queen and past champions. Active PKs that ended 2+ days ago lock automatically (hourly cron).
- **Milestone 4 (built):** migrations `0044`–`0045`. Termination by an admin or eligible upline for approved, unsettled PKs (resignation, transfer, data or system failure, customer pool change, emergency, other; note required): no winner, no points, stake void. PK Money debts are recorded when a PK with a stake settles (each loser owes the stake, split across the winners); the person owed marks it received; My PKs shows the monthly allowance, used, remaining, owed to you and you owe. Playbooks tab: searchable library of settled playbooks, filter by department and type.
- Old challenge functions no longer touch PK rows (`0038`). `create_challenge` is retired, and old challenges stay as history.
- PK notifications use `target_type = 'pk'` and open `/challenges/<id>`. The `send-push` function maps this (redeploy it for push links to go to the PK).
- **Phase 1 gaps + admin (built):** migrations `0046`–`0047`. Missed score updates are checked hourly against the PK's update frequency (Daily / Every 2 days / Weekly / Monthly): 1st miss a reminder, 2nd a recorded warning, 3rd a violation in `pk_violations` with the uplines notified; posting a score resets it. The department is notified when a PK goes live and when it settles. Admin → PK Arena card edits `pk_settings` (limits, PK Money allowances, open expiry, counter rounds, the three switches) and resolves violations.
