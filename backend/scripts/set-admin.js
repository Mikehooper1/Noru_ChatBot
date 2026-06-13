/**
 * Promote (or demote) a single platform admin.
 *
 * The platform is designed to have ONE admin. Businesses self-register and are
 * always created with role 'business' — they can never elevate themselves.
 * Use this script (which runs with Admin SDK privileges and bypasses Firestore
 * rules) to grant the admin role to exactly one trusted account.
 *
 * Usage:
 *   node scripts/set-admin.js admin@example.com
 *   node scripts/set-admin.js admin@example.com --demote
 *
 * The account must already exist in Firebase Authentication (i.e. the person
 * has signed up once via the app or Firebase console).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { initFirebase, getDb, getAuth, getFieldValue } = require('../src/firebase/admin');

async function run() {
  const email = process.argv[2];
  const demote = process.argv.includes('--demote');

  if (!email) {
    console.error('Usage: node scripts/set-admin.js <email> [--demote]');
    process.exit(1);
  }

  initFirebase();

  let userRecord;
  try {
    userRecord = await getAuth().getUserByEmail(email);
  } catch {
    console.error(`No Firebase Auth user found for ${email}.`);
    console.error('Ask them to sign up once in the app first, then re-run this script.');
    process.exit(1);
  }

  const role = demote ? 'business' : 'admin';
  const userRef = getDb().collection('users').doc(userRecord.uid);

  await userRef.set(
    {
      email,
      role,
      updatedAt: getFieldValue().serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`✅ ${email} (${userRecord.uid}) is now role="${role}".`);
  console.log('They may need to sign out and back in for the change to take effect.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed to set admin:', err.message);
  process.exit(1);
});
