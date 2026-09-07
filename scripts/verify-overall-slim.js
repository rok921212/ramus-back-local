// Manual, one-off verification for the overall-standings player slim
// (Bulkpublic.controller.js's OVERALL_VIEW_PLAYER_TIER / slimOverallPlayersForView
// — see that file's comment for the field-trace this asserts against),
// following the same standalone-script convention as verify-team-delta.js.
// NOT wired into npm start/CI.
//   Run: node scripts/verify-overall-slim.js
const {
  slimOverallPlayersForView,
  OVERALL_PLAYER_FIELDS,
  OVERALL_VIEW_PLAYER_TIER,
} = require('../controller/Bulkpublic.controller');

const results = [];
const pass = (msg) => results.push(`PASS: ${msg}`);
const fail = (msg) => results.push(`FAIL: ${msg}`);

// A synthetic full-fidelity player, shaped like what Mongo/aggregateOverallTeams
// actually returns for overallData.teams[].players[] — every field the
// codebase-wide field trace found NOT to be read, plus the 5 that are.
function synthFullPlayer(n) {
  return {
    _id: `pid${n}`, uId: `u${n}`, playerName: `Player${n}`, picUrl: `https://example/${n}.png`,
    killNum: n, damage: 100 * n, assists: 1, knockouts: 1, survivalTime: 900,
    headShotNum: 2, health: 100, healthMax: 100, liveState: 0, bHasDied: false, rank: n,
  };
}
function synthTeam(slot) {
  return {
    teamId: slot, teamTag: `T${slot}`, teamName: `Team ${slot}`, placePoints: 5, wwcd: false,
    players: [synthFullPlayer(slot * 2 - 1), synthFullPlayer(slot * 2)],
  };
}
const teams = [synthTeam(1), synthTeam(2), synthTeam(3)];

// --- 1. Every VIEWS_NEEDING_OVERALL view the trace covers has a tier ---
const expectedSlimmedViews = ['OverAllData', 'OverallFrags', 'LiveStats', '1stRunnerUp', '2ndRunnerUp', 'EventMvp', 'highlightPoints', 'Champions'];
const missing = expectedSlimmedViews.filter((v) => !OVERALL_VIEW_PLAYER_TIER[v]);
missing.length === 0
  ? pass(`All ${expectedSlimmedViews.length} standings views have an overall slim tier`)
  : fail(`Missing OVERALL_VIEW_PLAYER_TIER entries for: ${missing.join(', ')}`);

// --- 2. A listed view slims down to exactly the traced field set ---
const slimmed = slimOverallPlayersForView(teams, 'OverAllData');
const player = slimmed[0].players[0];
const gotFields = Object.keys(player).sort();
const wantFields = [...OVERALL_PLAYER_FIELDS].sort();
JSON.stringify(gotFields) === JSON.stringify(wantFields)
  ? pass(`OverAllData player slimmed to exactly [${wantFields.join(', ')}]`)
  : fail(`OverAllData player fields: got [${gotFields.join(', ')}], want [${wantFields.join(', ')}]`);

// --- 3. Every traced-necessary field survived with its real value ---
const survived = ['_id', 'uId', 'playerName', 'picUrl', 'killNum'].every((f) => player[f] === teams[0].players[0][f]);
survived
  ? pass('All 5 consumer-required fields (_id/uId/playerName/picUrl/killNum) survived slimming with correct values')
  : fail(`A required field did not survive slimming intact: ${JSON.stringify(player)}`);

// --- 4. A NOT-listed field is actually gone (proves it's slimming, not passing through) ---
!('damage' in player) && !('health' in player) && !('liveState' in player)
  ? pass('Unlisted fields (damage/health/liveState/...) are absent after slimming')
  : fail(`An unlisted field leaked through: ${JSON.stringify(player)}`);

// --- 5. team-level fields are untouched (only players[] is slimmed) ---
slimmed[0].teamTag === teams[0].teamTag && slimmed[0].placePoints === teams[0].placePoints
  ? pass('Team-level fields (teamTag/placePoints/...) untouched by slimming')
  : fail(`Team-level fields were altered: ${JSON.stringify(slimmed[0])}`);

// --- 6. An unlisted view is untouched (full fidelity, the existing fallback) ---
const untouched = slimOverallPlayersForView(teams, 'SomeFutureUnauditedView');
untouched === teams
  ? pass('An unlisted view returns the original teams array untouched (full-fidelity fallback)')
  : fail('An unlisted view did not fall back to full fidelity — this would silently break a future/unaudited view');

// --- 7. LiveStats gets the SAME overall slim as the others (its matchData ---
//     side is governed by the separate, untouched VIEW_PLAYER_TIER map — not
//     re-asserted here, but this confirms the overall side isn't accidentally
//     left at full fidelity for LiveStats specifically).
const liveStatsSlimmed = slimOverallPlayersForView(teams, 'LiveStats');
JSON.stringify(Object.keys(liveStatsSlimmed[0].players[0]).sort()) === JSON.stringify(wantFields)
  ? pass('LiveStats overall side slims identically to OverAllData')
  : fail('LiveStats overall side did not slim — check OVERALL_VIEW_PLAYER_TIER includes it');

console.log('\n=== OVERALL-SLIM VERIFICATION RESULTS ===');
results.forEach((r) => console.log(r));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed > 0 ? 1 : 0);
