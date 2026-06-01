import "dotenv/config";
import { backfillMissingRecordIds } from "../api/_lib/shipmentStore.js";

const apply = process.argv.includes("--apply");

if (process.argv.includes("--help")) {
  console.log("Usage: npm run backfill-record-ids -- [--apply]");
  console.log("Default mode is dry-run. Add --apply to write missing record_id values.");
  process.exit(0);
}

const result = await backfillMissingRecordIds({ dryRun: !apply });
console.log(JSON.stringify(result, null, 2));

if (!apply && result.missingRecordIds > 0) {
  console.log("Dry-run only. Re-run with --apply to write missing record_id values.");
}
