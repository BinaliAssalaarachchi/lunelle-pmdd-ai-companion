/**
 * Phase 4 owner UI helpers — pure logic, no browser, no Firebase.
 */
import {
  PARTNER_PERMISSION_DEFAULTS,
  PARTNER_PERMISSION_KEYS,
} from '../../../shared/partnerPermissions.js';
import {
  PARTNER_PERMISSION_UI,
  canOwnerInvite,
  normalizePermissionsForUi,
  pickOwnerConnection,
} from '../../../client/src/lib/partnerApi.js';

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'ASSERT';
    throw error;
  }
}

async function run() {
  const report = { ok: true, cases: {} };

  try {
    // UI copy covers all permission keys exactly once
    {
      const uiKeys = PARTNER_PERMISSION_UI.map((item) => item.key).sort();
      const specKeys = [...PARTNER_PERMISSION_KEYS].sort();
      assert(JSON.stringify(uiKeys) === JSON.stringify(specKeys), 'ui keys mismatch');
      assert(
        PARTNER_PERMISSION_UI.every((item) => item.title && item.description),
        'missing copy',
      );
      report.cases.permissionCopyComplete = { ok: true };
    }

    // Default permissions match SPEC
    {
      for (const item of PARTNER_PERMISSION_UI) {
        assert(
          normalizePermissionsForUi({})[item.key] === item.defaultOn,
          `default for ${item.key}`,
        );
      }
      report.cases.defaultPermissions = { ok: true };
    }

    // Connection states
    {
      const owner = 'owner-1';
      assert(pickOwnerConnection([], owner).state === 'none', 'empty');
      assert(
        pickOwnerConnection(
          [{ ownerId: owner, status: 'pending', id: 'a' }],
          owner,
        ).state === 'pending',
        'pending',
      );
      assert(
        pickOwnerConnection(
          [
            { ownerId: owner, status: 'revoked', id: 'r' },
            { ownerId: owner, status: 'active', id: 'x' },
          ],
          owner,
        ).state === 'active',
        'active wins',
      );
      assert(
        canOwnerInvite({ state: 'none', link: null }),
        'can invite none',
      );
      assert(
        canOwnerInvite({ state: 'revoked', link: { id: 'r' } }),
        'can invite after revoke',
      );
      assert(
        !canOwnerInvite({ state: 'active', link: { id: 'a' } }),
        'cannot invite active',
      );
      assert(
        !canOwnerInvite({ state: 'pending', link: { id: 'p' } }),
        'cannot invite pending',
      );
      report.cases.connectionStates = { ok: true };
    }

    // Doctor Coach is not a configurable permission in UI
    {
      assert(
        !PARTNER_PERMISSION_UI.some((item) => /coach/i.test(item.key + item.title)),
        'coach toggle in ui',
      );
      assert(!('doctorCoach' in PARTNER_PERMISSION_DEFAULTS), 'coach in defaults');
      report.cases.noCoachToggle = { ok: true };
    }

    console.log(JSON.stringify({ ok: true, cases: report.cases }, null, 2));
  } catch (error) {
    report.ok = false;
    console.error(
      JSON.stringify(
        { ok: false, error: error.message, cases: report.cases },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

run();
