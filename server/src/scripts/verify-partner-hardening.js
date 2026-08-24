/**
 * Phase 6 — consolidated partner-sharing security verification.
 * In-memory only — no Firebase / live server required.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPermissionGranted,
  PARTNER_PERMISSION_KEYS,
} from '../../../shared/partnerPermissions.js';
import {
  createMemoryPartnerLinkStore,
  createPartnerLifecycleService,
  sanitizeLinkForClient,
} from '../services/partnerLifecycle.js';
import {
  assertPartnerDtoSafe,
  buildPartnerViewDto,
  createMemoryPartnerOwnerData,
} from '../services/partnerView.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../../firebase/firestore.rules');

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'ASSERT';
    throw error;
  }
}

async function expectReject(fn, code) {
  try {
    await fn();
    throw new Error(`Expected rejection with code ${code}`);
  } catch (error) {
    if (error.code === 'ASSERT') throw error;
    assert(error.code === code, `expected ${code}, got ${error.code}: ${error.message}`);
  }
}

function onlyPermissions(keys) {
  const next = {};
  for (const key of PARTNER_PERMISSION_KEYS) {
    next[key] = keys.includes(key);
  }
  return next;
}

function seedOwnerData() {
  return createMemoryPartnerOwnerData({
    profiles: {
      'owner-1': {
        displayName: 'Maya',
        email: 'maya@secret.example',
        cycleLength: 28,
        periodLength: 5,
        lastPeriodStart: '2026-08-01',
      },
    },
    logs: {
      'owner-1': [
        {
          id: 'log-1',
          date: '2026-08-20',
          symptoms: { irritability: 4, anxiety: 5 },
          impact: { work: 3 },
          notes: 'Hard afternoon — private note text',
          _internal: 'must-not-leak',
        },
      ],
    },
    insights: {
      'owner-1': [
        {
          id: 'ins-1',
          summary: 'Anxiety rises in late luteal phase.',
          patterns: ['Sleep disruption correlates with mood'],
          generatedAt: '2026-08-19T12:00:00.000Z',
          evidenceSnapshot: { secret: true },
          doctorScript: 'NEVER SHARE',
        },
      ],
    },
  });
}

async function setupActiveLink(permissionsOverride = null) {
  const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
  const created = await svc.createInvitation({ ownerId: 'owner-1' });
  await svc.acceptInvitation({
    userId: 'partner-1',
    inviteCode: created.inviteCode,
  });
  if (permissionsOverride) {
    await svc.updatePermissions({
      userId: 'owner-1',
      linkId: created.link.id,
      permissions: permissionsOverride,
    });
  }
  const link = await svc.store.get(created.link.id);
  return { svc, link };
}

async function viewAs(svc, ownerData, userId, linkId) {
  const authz = await svc.authorizePartnerViewAccess({ userId, linkId });
  return buildPartnerViewDto({
    link: authz.link,
    requesterId: userId,
    ownerData,
  });
}

function assertFirestoreRulesHardened() {
  const rules = readFileSync(RULES_PATH, 'utf8');
  const partnerBlock = rules.match(/match \/partnerLinks\/\{linkId\}[\s\S]*?\}/);
  assert(partnerBlock, 'partnerLinks rules block missing');
  const block = partnerBlock[0];
  assert(
    /allow read,\s*write:\s*if false/.test(block),
    'partnerLinks must deny all client read/write',
  );
  assert(!/isPartnerLinkParticipant/.test(rules), 'client participant read helper must be removed');
  assert(
    /match \/users\/\{userId\}/.test(rules),
    'users rules must remain',
  );
  assert(
    /match \/symptomLogs\/\{logId\}/.test(rules),
    'symptomLogs owner-only rules must remain',
  );
}

async function run() {
  const report = { ok: true, cases: {} };
  const ownerData = seedOwnerData();

  try {
    assertFirestoreRulesHardened();
    report.cases.firestorePartnerLinksDenyAll = { ok: true };

    // Partner-only curated view (6.3)
    {
      const { svc, link } = await setupActiveLink();
      await expectReject(
        () => viewAs(svc, ownerData, 'owner-1', link.id),
        'CLINICAL_ACCESS_PARTNER_ONLY',
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert(dto.relationship.role === 'partner', 'partner role only');
      report.cases.partnerOnlyViewApi = { ok: true };
    }

    // Cross-link IDOR — partner on link A cannot view link B
    {
      const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
      const linkA = await svc.createInvitation({ ownerId: 'owner-a' });
      await svc.acceptInvitation({
        userId: 'partner-a',
        inviteCode: linkA.inviteCode,
      });
      const linkB = await svc.createInvitation({ ownerId: 'owner-b' });
      await svc.acceptInvitation({
        userId: 'partner-b',
        inviteCode: linkB.inviteCode,
      });
      await expectReject(
        () => viewAs(svc, ownerData, 'partner-a', linkB.link.id),
        'CLINICAL_ACCESS_DENIED',
      );
      report.cases.crossLinkIdor = { ok: true };
    }

    // Revoked / pending deny immediately
    {
      const { svc, link } = await setupActiveLink();
      await svc.revokeLink({ userId: 'owner-1', linkId: link.id });
      await expectReject(
        () => viewAs(svc, ownerData, 'partner-1', link.id),
        'CLINICAL_ACCESS_REVOKED',
      );

      const pendingSvc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
      const pending = await pendingSvc.createInvitation({ ownerId: 'owner-2' });
      await expectReject(
        () => viewAs(pendingSvc, ownerData, 'partner-9', pending.link.id),
        'CLINICAL_ACCESS_PENDING',
      );
      report.cases.revokedAndPendingDeny = { ok: true };
    }

    // Partner permission escalation blocked
    {
      const { svc, link } = await setupActiveLink();
      await expectReject(
        () =>
          svc.updatePermissions({
            userId: 'partner-1',
            linkId: link.id,
            permissions: {
              symptomDetails: true,
              privateAiInsights: true,
              doctorCoach: true,
            },
          }),
        'PERMISSIONS_OWNER_ONLY',
      );
      report.cases.partnerCannotEscalate = { ok: true };
    }

    // All permissions on — still no Doctor Coach
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions([...PARTNER_PERMISSION_KEYS]),
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assertPartnerDtoSafe(dto);
      const raw = JSON.stringify(dto);
      assert(!raw.includes('doctorScript'), 'doctorScript leaked');
      assert(!raw.includes('evidenceSnapshot'), 'evidenceSnapshot leaked');
      assert(!raw.includes('COACH_DISCLAIMER'), 'coach disclaimer leaked');
      assert(!('doctorCoach' in dto), 'doctorCoach key');
      assert(!('coach' in dto), 'coach key');
      report.cases.doctorCoachExcluded = { ok: true };
    }

    // No raw Firestore fields / secrets in DTO
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['symptomDetails', 'personalNotes', 'privateAiInsights']),
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      const raw = JSON.stringify(dto);
      assert(!raw.includes('_internal'), '_internal field');
      assert(!raw.includes('inviteCodeHash'), 'inviteCodeHash');
      assert(!raw.includes('maya@secret'), 'owner email');
      assert(!raw.includes('FIREBASE'), 'firebase secret');
      assertPartnerDtoSafe(dto);
      report.cases.noRawOrSecrets = { ok: true };
    }

    // Default-deny permissions
    {
      assert(isPermissionGranted({}, 'symptomDetails') === false, 'missing deny');
      assert(isPermissionGranted({ symptomDetails: 'true' }, 'symptomDetails') === false, 'string deny');
      const { svc, link } = await setupActiveLink(onlyPermissions([]));
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      for (const key of ['cycle', 'support', 'symptoms', 'notes', 'insights']) {
        assert(!Object.prototype.hasOwnProperty.call(dto, key), `${key} present when all off`);
      }
      report.cases.defaultDenyPermissions = { ok: true };
    }

    // Link metadata sanitization — no invite hash or coach fields
    {
      const sanitized = sanitizeLinkForClient({
        id: 'x',
        ownerId: 'o',
        partnerId: 'p',
        inviteCodeHash: 'secret-hash',
        status: 'active',
        permissions: onlyPermissions(['cycleReminders']),
        doctorCoach: { turns: ['hidden'] },
      });
      assert(!('inviteCodeHash' in sanitized), 'hash in link metadata');
      assert(!('doctorCoach' in sanitized), 'coach in link metadata');
      report.cases.sanitizeLinkMetadata = { ok: true };
    }

    // Permission disable is immediate in DTO
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['personalNotes', 'cycleReminders']),
      );
      const before = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert('notes' in before && 'cycle' in before, 'before sections');
      await svc.updatePermissions({
        userId: 'owner-1',
        linkId: link.id,
        permissions: { personalNotes: false },
      });
      const after = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert(!('notes' in after), 'notes still present after disable');
      assert('cycle' in after, 'cycle should remain');
      report.cases.permissionDisableImmediate = { ok: true };
    }

    console.log(JSON.stringify({ ok: true, cases: report.cases }, null, 2));
  } catch (error) {
    report.ok = false;
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error.message,
          code: error.code,
          cases: report.cases,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

run();
