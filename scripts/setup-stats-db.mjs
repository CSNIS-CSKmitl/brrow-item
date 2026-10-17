import PocketBase from 'pocketbase';

const apply = process.argv.includes('--apply');
const pb = new PocketBase(process.env.POCKETBASE_URL || process.env.VITE_POCKETBASE_TARGET || 'http://127.0.0.1:8090');
if (!process.env.PB_ADMIN_EMAIL || !process.env.PB_ADMIN_PASSWORD) throw new Error('Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD.');
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
const collection = await pb.collections.getOne('loan_requests');
const fields = structuredClone(collection.fields);
let changed = false;

const returnedAtIndex = fields.findIndex((field) => field.name === 'returnedAt');
if (returnedAtIndex === -1) {
  fields.push({ type: 'date', name: 'returnedAt', required: false });
  changed = true;
} else if (fields[returnedAtIndex].type !== 'date') {
  fields[returnedAtIndex] = { type: 'date', name: 'returnedAt', required: false };
  changed = true;
}

const statusField = fields.find((field) => field.name === 'status' && field.type === 'select');
if (statusField && !statusField.values.includes('returned')) {
  statusField.values = [...statusField.values, 'returned'];
  changed = true;
}

let updateRule = collection.updateRule || '';
const returnRuleSnippet = '((@request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin") && (status = "approved" || status = "returned") && @request.body.status = "returned")';
if (updateRule && !updateRule.includes('@request.body.status = "returned"')) {
  updateRule = `${updateRule} || ${returnRuleSnippet}`;
  changed = true;
}

if (!changed) {
  console.log('loan_requests.returnedAt, status="returned", and updateRule are already up to date.');
  process.exit(0);
}
console.log('Update loan_requests schema: ensure returnedAt (date), status value "returned", and return updateRule.');
if (!apply) {
  console.log('Dry run only. Add --apply to update the collection.');
  process.exit(0);
}
await pb.collections.update(collection.id, { fields, updateRule });
const verified = await pb.collections.getOne(collection.id);
if (!verified.fields.some((field) => field.name === 'returnedAt' && field.type === 'date')) {
  throw new Error('returnedAt verification failed.');
}
if (!verified.fields.find((field) => field.name === 'status')?.values?.includes('returned')) {
  throw new Error('status="returned" verification failed.');
}
console.log('Updated and verified loan_requests (returnedAt + returned status + updateRule).');
