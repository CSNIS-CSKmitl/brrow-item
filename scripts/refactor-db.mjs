import PocketBase from 'pocketbase';

const apply = process.argv.includes('--apply');
const dropLegacy = process.argv.includes('--drop-legacy');
const targetUrl = process.env.POCKETBASE_URL || process.env.VITE_POCKETBASE_TARGET || 'http://127.0.0.1:8090';
const adminEmail = process.env.PB_ADMIN_EMAIL;
const adminPassword = process.env.PB_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  throw new Error('Please set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in environment.');
}

const pb = new PocketBase(targetUrl);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
console.log(`Connected to PocketBase at ${targetUrl} as ${adminEmail}`);

// 1. Inspect and fix items collection data integrity
const itemsCol = await pb.collections.getOne('items');
const allItems = await pb.collection('items').getFullList();
console.log(`\n--- Inspecting ${allItems.length} items ---`);
for (const item of allItems) {
  const avail = Number(item.available) || 0;
  const tot = Number(item.total) || 0;
  if (avail > tot || tot === 0) {
    const fixedTotal = Math.max(tot, avail, 15);
    console.log(`[Item Stock Fix] ${item.name} (${item.id}): available=${avail}, total=${tot} -> proposed total=${fixedTotal}`);
    if (apply) {
      await pb.collection('items').update(item.id, { total: fixedTotal });
      console.log(`  -> Fixed item ${item.id} total to ${fixedTotal}`);
    }
  } else {
    console.log(`[Item OK] ${item.name} (${item.id}): available=${avail}/${tot}`);
  }
}

// 2. Migrate records first to ensure 100% data integrity before touching schema
const allRequests = await pb.collection('loan_requests').getFullList();
console.log(`\n--- Verifying/Migrating ${allRequests.length} loan_requests ---`);
for (const req of allRequests) {
  const patch = {};
  if ((!Array.isArray(req.items) || req.items.length === 0) && Array.isArray(req.itemIds) && req.itemIds.length > 0) {
    patch.items = req.itemIds;
  }
  if (req.status === 'approved' && !req.approvedAt) {
    patch.approvedAt = req.updated || req.created;
  }
  if (req.adminComment && !req.asset_tags) {
    patch.asset_tags = req.adminComment;
  }

  if (Object.keys(patch).length > 0) {
    console.log(`[Record Migration] Request ${req.id} (${req.borrowerName}): patching ${JSON.stringify(patch)}`);
    if (apply) {
      await pb.collection('loan_requests').update(req.id, patch);
      console.log(`  -> Migrated request ${req.id}`);
    }
  } else {
    console.log(`[Record OK] Request ${req.id} (${req.borrowerName}) has items relation and fields populated`);
  }
}

// 3. Update loan_requests collection schema
const loanReqCol = await pb.collections.getOne('loan_requests');
let fields = structuredClone(loanReqCol.fields);
let schemaChanged = false;

// Check 'items' relation field
let itemsField = fields.find((f) => f.name === 'items');
if (!itemsField) {
  fields.push({
    type: 'relation',
    name: 'items',
    required: false,
    collectionId: itemsCol.id,
    cascadeDelete: false,
    maxSelect: 50,
  });
  schemaChanged = true;
  console.log('[Schema] Adding "items" (relation -> items) field');
}

// Check 'asset_tags' text field
let assetTagsField = fields.find((f) => f.name === 'asset_tags');
if (!assetTagsField) {
  fields.push({
    type: 'text',
    name: 'asset_tags',
    required: false,
  });
  schemaChanged = true;
  console.log('[Schema] Adding "asset_tags" (text) field');
}

// Check 'approvedAt' date field
let approvedAtField = fields.find((f) => f.name === 'approvedAt');
if (!approvedAtField) {
  fields.push({
    type: 'date',
    name: 'approvedAt',
    required: false,
  });
  schemaChanged = true;
  console.log('[Schema] Adding "approvedAt" (date) field');
}

// If --drop-legacy is requested, drop legacy 'itemIds'
if (dropLegacy) {
  const itemIdsIndex = fields.findIndex((f) => f.name === 'itemIds');
  if (itemIdsIndex !== -1) {
    fields.splice(itemIdsIndex, 1);
    schemaChanged = true;
    console.log('[Schema] Dropping legacy "itemIds" (json) field');
  }
}

// Check updateRule
let updateRule = loanReqCol.updateRule || '';
if (dropLegacy) {
  // Strip itemIds:changed from updateRule completely
  updateRule = updateRule.replaceAll('@request.body.itemIds:changed = false && ', '');
  updateRule = updateRule.replaceAll(' && @request.body.itemIds:changed = false', '');
  if (!updateRule.includes('@request.body.items:changed = false')) {
    updateRule = updateRule.replaceAll(
      'status = "pending_teacher"',
      'status = "pending_teacher" && @request.body.items:changed = false'
    );
  }
  schemaChanged = true;
  console.log('[Schema] Cleaned updateRule to use only "items:changed = false"');
} else if (!updateRule.includes('@request.body.items:changed = false')) {
  updateRule = updateRule.replaceAll(
    '@request.body.itemIds:changed = false',
    '@request.body.itemIds:changed = false && @request.body.items:changed = false'
  );
  schemaChanged = true;
  console.log('[Schema] Updating updateRule with items:changed constraint');
}

if (schemaChanged) {
  if (apply) {
    await pb.collections.update(loanReqCol.id, { fields, updateRule });
    console.log('[Schema] Successfully updated loan_requests collection schema');
  } else {
    console.log('[Schema] Dry run: schema changes ready to apply with --apply');
  }
} else {
  console.log('[Schema] loan_requests schema is already up to date');
}

console.log(`\n=== Migration ${apply ? 'COMPLETE' : 'DRY RUN FINISHED (use --apply to execute)'} ===`);
