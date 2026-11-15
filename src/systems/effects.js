// effects.js: what each road item does when the kart hits it, misses it,
// pulls in beside it, or passes it. Numbers come from config.js (PRD tables).
import { CONFIG } from '../config.js';

const T = CONFIG.triggers;
const S = CONFIG.support;
const H = CONFIG.hazards;
const BUZZ_HIT = [70];
const BUZZ_SUPPORT = [50, 60, 50];

/** `ds` is the DriveScreen: uses ds.mood, ds.hud, ds.flags, ds.stats, ds.app, ds.lane, ds.log. */
export function applyItemEvent(ds, ev) {
  const { item, type } = ev;
  const { mood, hud, flags, app } = ds;
  const id = item.id;
  const log = (effect) => ds.log?.event(ds.time, id, type, effect, mood);
  const pop = (text, tone) => hud.toast(text, tone, id); // bottom pop-up with the item's icon
  const sfx = (name, opts) => app.sound.play(name, opts);

  if (type === 'finish') { ds.finish(); return; }

  // ----- Coins: score only. In a depressive episode they are grey and worth nothing (loss of interest). -----
  if (id === 'coin') {
    if (type !== 'hit') return;
    const dull = mood.phase === 'depressive';
    sfx('coin', { dull });
    ds.coins.collected++;
    if (dull) ds.coins.dull++; else ds.coins.points += CONFIG.coins.points;
    return;
  }
  // ----- Open lane at the stigma billboards -----
  if (id === 'notAlone') {
    if (type !== 'hit') return log('missed');
    app.buzz(BUZZ_SUPPORT);
    pop(CONFIG.stigmaOpenLaneText, 'good');
    return log('avoided stigma');
  }

  // ----- Triggers -----
  if (T[id]) {
    if (type !== 'hit') { log('dodged'); return; }
    ds.stats.triggers++;
    flags.hop = 1;
    app.buzz(BUZZ_HIT);
    if (id === 'stigmaBillboard') {
      const before = mood.guardrails;
      mood.addGuardrails(T.stigmaBillboard.guardrails);
      sfx('stigmaBillboard', { crack: mood.guardrails < before });
      pop('Stigma: one guardrail lost', 'down');
      return log('guardrail -1');
    }
    if (id === 'scheduleChaos' && flags.blockChaos) {
      flags.blockChaos = false;
      pop('Your routine kept the rhythm', 'good');
      return log('blocked by routine');
    }
    sfx(id);
    const push = Array.isArray(T[id].push) ? T[id].push[Math.random() < 0.5 ? 0 : 1] : T[id].push;
    const applied = mood.push(push);
    if (mood.inEpisode) pop(`${T[id].label}`, push > 0 ? 'up' : 'down');
    else pop(`${T[id].label}: mood ${push > 0 ? 'up' : 'down'}`, push > 0 ? 'up' : 'down');
    return log(`push ${applied.toFixed(0)}`);
  }

  // ----- Drive-through support -----
  if (id === 'medCheckpoint') {
    if (type === 'hit') {
      mood.addGuardrails(S.medCheckpoint.guardrails);
      sfx('medication');
      ds.stats.support++;
      app.buzz(BUZZ_SUPPORT);
      pop('Medication taken: guardrails build up', 'good');
      return log('guardrail +1');
    }
    mood.addGuardrails(S.medCheckpoint.missed);
    if (mood.inEpisode) mood.changeEpisode(CONFIG.episode.missedMedSec);
    pop('Missed medication: one guardrail lost', 'down');
    return log('missed: guardrail -1');
  }
  if (id === 'routineCheckpoint') {
    if (type !== 'hit') return log('missed');
    mood.toCentre(S.routineCheckpoint.toCentre);
    sfx('routineCheckpoint');
    flags.blockChaos = true;
    ds.stats.support++;
    app.buzz(BUZZ_SUPPORT);
    pop('Routine: steadier days', 'good');
    return log('to centre');
  }
  if (id === 'supportive') {
    if (type !== 'hit') return log('missed');
    mood.toCentre(S.familyPit.supportiveToCentre);
    ds.stats.support++;
    app.buzz(BUZZ_SUPPORT);
    pop('Support instead of criticism', 'good');
    return log('to centre');
  }

  // ----- Pull-in stops -----
  if (type === 'pull') {
    if (id === 'restStop' && mood.phase === 'manic') {
      // Decreased need for sleep (DSM-5): the rest stop flashes by.
      pop('Doesn’t feel tired', 'up');
      item.pulled = true;
      return log('could not rest (manic)');
    }
    item.pulled = true;
    ds.stats.support++;
    app.buzz(BUZZ_SUPPORT);
    sfx(id); // restStop / therapyPit / familyPit
    if (id === 'restStop') {
      mood.toCentre(S.restStop.toCentre);
      mood.changeEpisode(S.restStop.episodeSec);
      pop('Rested: mood steadier', 'good');
    } else if (id === 'therapyPit') {
      mood.changeEpisode(S.therapyPit.episodeSec);
      flags.highlightLeft = S.therapyPit.highlightNext;
      pop('Therapy: you’ll spot the next triggers early', 'good');
    } else if (id === 'familyPit') {
      mood.changeEpisode(S.familyPit.episodeSec);
      flags.convertCriticism = true;
      pop('Family & friends: support is here', 'good');
    }
    return log('pulled in');
  }

  // ----- Episode hazards -----
  if (type === 'hit' && (id === 'cliffRamp' || id === 'spendDetour')) {
    mood.changeEpisode(H[id].episodeSec);
    flags.hop = 1;
    app.buzz(BUZZ_HIT);
    pop(id === 'cliffRamp' ? 'Risky shortcut: the episode drags on' : 'Spending spree: money gone', 'up');
    return log(`episode +${H[id].episodeSec}s`);
  }
  if (type === 'hit' && id === 'mud') {
    flags.slowTimer = H.mud.slowSec;
    app.buzz(BUZZ_HIT);
    pop('Stuck in the mud', 'down');
    return log('slowed');
  }
  if (type === 'near' && id === 'harshSigns') { pop('Harsh self-talk', 'down'); return log('near'); }
  if (type === 'near' && id === 'racingSigns') { pop('Thoughts racing', 'up'); return log('near'); }
  if (type === 'near' && id === 'billboardPull') {
    // Distractibility: the shiny billboard tugs the steering toward it.
    if (ds.lane !== item.side) { ds.lane = Math.max(-1, Math.min(1, ds.lane + item.side)); pop('Distracted!', 'up'); }
    return log('tugged');
  }
  if (type === 'near' && id === 'fogFork') { app.world.weather.fogBurst(3); pop('Hard to decide which way', 'down'); return log('fog'); }
  log(type);
}
