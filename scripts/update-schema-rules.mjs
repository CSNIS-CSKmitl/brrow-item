import PocketBase from 'pocketbase';

const apply = process.argv.includes('--apply');
const targetUrl = process.env.POCKETBASE_URL || process.env.VITE_POCKETBASE_TARGET || 'http://127.0.0.1:8090';
const adminEmail = process.env.PB_ADMIN_EMAIL;
const adminPassword = process.env.PB_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.warn('⚠️  PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD not set in environment.');
  console.warn('   Run with: PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret node scripts/update-schema-rules.mjs [--apply]');
}

async function run() {
  if (!adminEmail || !adminPassword) {
    process.exit(1);
  }

  const pb = new PocketBase(targetUrl);
  pb.autoCancellation(false);
  await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
  console.log(`Connected to PocketBase at ${targetUrl} as ${adminEmail}`);

  // 1. Update loan_requests rules and fields
  console.log('\n--- 1. Checking loan_requests ---');
  const loanReqCol = await pb.collections.getOne('loan_requests');
  
  const targetLoanReqListRule = '@request.auth.id != "" && (requester = @request.auth.id || teacher = @request.auth.id || caretaker = @request.auth.id || @request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin")';
  const targetLoanReqViewRule = '@request.auth.id != "" && (requester = @request.auth.id || teacher = @request.auth.id || caretaker = @request.auth.id || @request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin")';
  const targetLoanReqDeleteRule = '@request.auth.id != "" && @request.auth.user_type.type = "superadmin"';
  
  const targetLoanReqCreateRule = '@request.auth.id != "" && @request.body.requester = @request.auth.id && (@request.body.status = "pending_teacher" || (@request.auth.user_type.type = "teachers" && @request.body.status = "pending_caretaker" && @request.body.teacher = @request.auth.id) || ((@request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin") && @request.body.status = "approved" && @request.body.teacher = @request.auth.id && @request.body.caretaker = @request.auth.id))';
  
  const targetLoanReqUpdateRule = '(requester = @request.auth.id && status = "pending_teacher" && (@request.body.status:changed = false || @request.body.status = "cancelled") && @request.body.requester:changed = false && @request.body.borrowerName:changed = false && @request.body.email:changed = false && @request.body.items:changed = false && @request.body.caretaker:changed = false && @request.body.teacherComment:changed = false && @request.body.adminComment:changed = false) || (teacher = @request.auth.id && @request.auth.user_type.type = "teachers" && status = "pending_teacher" && ((@request.body.status = "pending_caretaker" && @request.body.teacherComment:changed = false) || (@request.body.status = "rejected" && @request.body.teacherComment != "")) && @request.body.requester:changed = false && @request.body.borrowerName:changed = false && @request.body.email:changed = false && @request.body.items:changed = false && @request.body.dueDate:changed = false && @request.body.note:changed = false && @request.body.teacher:changed = false && @request.body.caretaker:changed = false && @request.body.adminComment:changed = false) || ((@request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin") && status = "pending_caretaker" && ((@request.body.status = "approved" && @request.body.teacherComment:changed = false) || (@request.body.status = "rejected" && @request.body.teacherComment:changed = false && @request.body.adminComment != ""))) || ((@request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin") && (status = "approved" || status = "returned") && @request.body.status = "returned")';

  let reqChanged = false;
  let reqPatch = {};

  if (loanReqCol.listRule !== targetLoanReqListRule) {
    console.log('[loan_requests] Update listRule: add admin and caretaker');
    reqPatch.listRule = targetLoanReqListRule;
    reqChanged = true;
  }
  if (loanReqCol.viewRule !== targetLoanReqViewRule) {
    console.log('[loan_requests] Update viewRule: add admin and caretaker');
    reqPatch.viewRule = targetLoanReqViewRule;
    reqChanged = true;
  }
  if (loanReqCol.deleteRule !== targetLoanReqDeleteRule) {
    console.log('[loan_requests] Update deleteRule: add auth check');
    reqPatch.deleteRule = targetLoanReqDeleteRule;
    reqChanged = true;
  }
  if (loanReqCol.createRule !== targetLoanReqCreateRule) {
    console.log('[loan_requests] Update createRule: allow admin');
    reqPatch.createRule = targetLoanReqCreateRule;
    reqChanged = true;
  }
  if (loanReqCol.updateRule !== targetLoanReqUpdateRule) {
    console.log('[loan_requests] Update updateRule: allow requester cancellation');
    reqPatch.updateRule = targetLoanReqUpdateRule;
    reqChanged = true;
  }

  // Check field maxSelect in loan_requests
  const reqFields = structuredClone(loanReqCol.fields);
  let fieldsChanged = false;
  for (const fieldName of ['requester', 'teacher', 'caretaker']) {
    const f = reqFields.find(f => f.name === fieldName);
    if (f && f.maxSelect === 0) {
      console.log(`[loan_requests] Fix maxSelect: 1 for relation "${fieldName}"`);
      f.maxSelect = 1;
      fieldsChanged = true;
    }
  }
  const statusField = reqFields.find(f => f.name === 'status');
  if (statusField && statusField.maxSelect === 0) {
    console.log('[loan_requests] Fix maxSelect: 1 for select "status"');
    statusField.maxSelect = 1;
    fieldsChanged = true;
  }

  if (fieldsChanged) {
    reqPatch.fields = reqFields;
    reqChanged = true;
  }

  if (reqChanged) {
    if (apply) {
      await pb.collections.update(loanReqCol.id, reqPatch);
      console.log('✅ [loan_requests] Successfully updated schema and rules');
    } else {
      console.log('ℹ️  [loan_requests] Changes pending (use --apply to execute)');
    }
  } else {
    console.log('✅ [loan_requests] Schema and rules are already up to date');
  }

  // 2. Update loan_items rules and schema
  console.log('\n--- 2. Checking loan_items ---');
  let loanItemsCol;
  try {
    loanItemsCol = await pb.collections.getOne('loan_items');
  } catch {
    console.log('[loan_items] Collection does not exist yet. Will create if applying.');
  }

  const targetItemRules = {
    listRule: '@request.auth.id != "" && (request.requester = @request.auth.id || request.teacher = @request.auth.id || request.caretaker = @request.auth.id || @request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin")',
    viewRule: '@request.auth.id != "" && (request.requester = @request.auth.id || request.teacher = @request.auth.id || request.caretaker = @request.auth.id || @request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin")',
    createRule: '@request.auth.id != "" && (request.requester = @request.auth.id || @request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin" || @request.auth.user_type.type = "teachers")',
    updateRule: '@request.auth.id != "" && (@request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin" || (request.requester = @request.auth.id && request.status = "pending_teacher"))',
    deleteRule: '@request.auth.id != "" && (@request.auth.user_type.type = "superadmin" || @request.auth.user_type.type = "admin" || (request.requester = @request.auth.id && request.status = "pending_teacher"))'
  };

  if (loanItemsCol) {
    let itemChanged = false;
    let itemPatch = {};

    for (const [rKey, rVal] of Object.entries(targetItemRules)) {
      if (loanItemsCol[rKey] !== rVal) {
        console.log(`[loan_items] Update ${rKey}: secure access by request ownership / admin roles`);
        itemPatch[rKey] = rVal;
        itemChanged = true;
      }
    }

    // Check indexes
    const indexes = loanItemsCol.indexes || [];
    const expectedIndexes = [
      'CREATE INDEX idx_loan_items_request ON loan_items (request)',
      'CREATE INDEX idx_loan_items_item ON loan_items (item)',
      'CREATE INDEX idx_loan_items_status ON loan_items (status)'
    ];
    let newIndexes = [...indexes];
    for (const exp of expectedIndexes) {
      if (!newIndexes.some(idx => idx.replace(/\s+/g, ' ').trim() === exp.replace(/\s+/g, ' ').trim())) {
        console.log(`[loan_items] Add index: ${exp}`);
        newIndexes.push(exp);
        itemChanged = true;
      }
    }
    if (newIndexes.length !== indexes.length) {
      itemPatch.indexes = newIndexes;
    }

    if (itemChanged) {
      if (apply) {
        await pb.collections.update(loanItemsCol.id, itemPatch);
        console.log('✅ [loan_items] Successfully updated schema and rules');
      } else {
        console.log('ℹ️  [loan_items] Changes pending (use --apply to execute)');
      }
    } else {
      console.log('✅ [loan_items] Schema and rules are already up to date');
    }
  }

  console.log(`\n=== Migration ${apply ? 'COMPLETE' : 'DRY RUN FINISHED (use --apply to execute)'} ===`);
}

run().catch((err) => {
  console.error('Error during migration:', err);
  process.exit(1);
});
