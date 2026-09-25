#!/usr/bin/env node
// Records a sample's progress in intake.yaml (§2). Usage: status.mjs <id> [<status>]
import { STATUSES, isSample, readIntake, setStatus, die } from './lib.mjs';

const [id, status] = process.argv.slice(2);
if (!id || !isSample(id)) die(`usage: status.mjs <sample-id> [${STATUSES.join('|')}]`);
if (status) setStatus(id, status);
console.log(`${id}: ${readIntake(id).status}`);
