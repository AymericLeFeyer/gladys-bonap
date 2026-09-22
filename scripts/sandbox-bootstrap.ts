// Runs the integration's Mealie bootstrap against the sandbox Mealie
// (docker-compose.sandbox.yml), then prints the next meal widget content.
// Usage: npm run sandbox:bootstrap [-- http://localhost:9000]

import { bootstrapMealie, waitForMealie } from '../src/application/mealie/bootstrapMealie.ts';
import { buildNextMealContent } from '../src/application/widget/nextMealWidget.ts';
import { addDays, findNextMeal, toLocalDay } from '../src/domain/meal/nextMeal.ts';
import { MealieClient } from '../src/infrastructure/mealie/MealieClient.ts';
import { StateStore } from '../src/infrastructure/state/StateStore.ts';

const url = process.argv[2] ?? 'http://localhost:9000';
const store = new StateStore('sandbox-data/state.json');
const anonymous = new MealieClient(url);

console.log(`Waiting for Mealie at ${url}…`);
if (!(await waitForMealie(anonymous, { timeoutMs: 5 * 60_000 }))) {
  console.error('Mealie did not answer in 5 minutes');
  process.exit(1);
}

const credentials = await bootstrapMealie(anonymous, store);
console.log('Mealie bootstrapped (sandbox-data/state.json):');
console.log(`  email:    ${credentials.email}`);
console.log(`  password: ${credentials.password}`);
console.log(`  token:    ${credentials.apiToken.slice(0, 12)}…`);
console.log(`\nStart Bonap with:  MEALIE_TOKEN=${credentials.apiToken} ./scripts/sandbox.sh bonap`);

const mealie = anonymous.withToken(credentials.apiToken);
const now = new Date();
const entries = await mealie.getMealPlans(toLocalDay(now), toLocalDay(addDays(now, 7)));
console.log('\nNext meal widget content:');
console.log(JSON.stringify(buildNextMealContent(findNextMeal(entries, now), now, 'fr'), null, 2));
