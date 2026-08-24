/**
 * Phase 6.6 — permission/revoke propagation client tests.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  partnerViewSectionKeys,
  resolvePartnerViewAfterFetch,
  shouldClearPartnerViewOnFetchFailure,
} from '../../../client/src/lib/partnerViewUi.js';
import {
  createMemoryPartnerLinkStore,
  createPartnerLifecycleService,
} from '../services/partnerLifecycle.js';
import {
  buildPartnerViewDto,
  createMemoryPartnerOwnerData,
} from '../services/partnerView.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'ASSERT';
    throw error;
  }
}

function onlyPermissions(enabled) {
  return {
    cycleReminders: enabled.includes('cycleReminders'),
    generalSupportGuidance: enabled.includes('generalSupportGuidance'),
    symptomDetails: enabled.includes('symptomDetails'),
    personalNotes: enabled.includes('personalNotes'),
    privateAiInsights: enabled.includes('privateAiInsights'),
  };
}

const ownerData = createMemoryPartnerOwnerData({
  profiles: {
    'owner-1': {
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: '2026-08-01',
    },
  },
  logs: {
    'owner-1': [
      {
        date: '2026-08-20',
        symptoms: { anxiety: 5, irritability: 4 },
        impact: { work: 3 },
        notes: 'Shared note text',
      },
    ],
  },
  insights: {
    'owner-1': [
      {
        summary: 'Pattern summary',
        patterns: ['Luteal rise'],
        generatedAt: '2026-08-19T12:00:00.000Z',
      },
    ],
  },
});

async function setupActiveLink(permissions) {
  const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
  const created = await svc.createInvitation({ ownerId: 'owner-1' });
  await svc.acceptInvitation({
    userId: 'partner-1',
    inviteCode: created.inviteCode,
  });
  if (permissions) {
    await svc.updatePermissions({
      userId: 'owner-1',
      linkId: created.link.id,
      permissions,
    });
  }
  const link = await svc.store.get(created.link.id);
  return { svc, link };
}

async function partnerView(link) {
  return buildPartnerViewDto({
    link,
    requesterId: 'partner-1',
    ownerData,
  });
}

async function run() {
  const report = { ok: true, cases: {} };

  try {
    // Permission ON → section appears
    {
      const { link } = await setupActiveLink(
        onlyPermissions(['symptomDetails', 'cycleReminders']),
      );
      const dto = await partnerView(link);
      const keys = partnerViewSectionKeys(dto);
      assert(keys.includes('symptoms'), 'symptoms on');
      assert(keys.includes('cycle'), 'cycle on');
      report.cases.permissionOnSectionAppears = { ok: true };
    }

    // Permission OFF → subsequent fetch omits section
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['symptomDetails', 'personalNotes']),
      );
      const before = await partnerView(link);
      assert('symptoms' in before && 'notes' in before, 'before sections');
      await svc.updatePermissions({
        userId: 'owner-1',
        linkId: link.id,
        permissions: { symptomDetails: false, personalNotes: false },
      });
      const updated = await svc.store.get(link.id);
      const after = await partnerView(updated);
      assert(!('symptoms' in after), 'symptoms removed');
      assert(!('notes' in after), 'notes removed');
      report.cases.permissionOffSectionOmitted = { ok: true };
    }

    // Multiple permission changes reflected correctly
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['cycleReminders']),
      );
      let dto = await partnerView(link);
      assert(partnerViewSectionKeys(dto).join(',') === 'cycle', 'cycle only');

      await svc.updatePermissions({
        userId: 'owner-1',
        linkId: link.id,
        permissions: {
          cycleReminders: true,
          generalSupportGuidance: true,
          symptomDetails: true,
        },
      });
      dto = await partnerView(await svc.store.get(link.id));
      assert(partnerViewSectionKeys(dto).includes('support'), 'support added');
      assert(partnerViewSectionKeys(dto).includes('symptoms'), 'symptoms added');

      await svc.updatePermissions({
        userId: 'owner-1',
        linkId: link.id,
        permissions: {
          symptomDetails: false,
          privateAiInsights: true,
        },
      });
      dto = await partnerView(await svc.store.get(link.id));
      assert(!('symptoms' in dto), 'symptoms off again');
      assert('insights' in dto, 'insights on');
      report.cases.multiplePermissionChanges = { ok: true };
    }

    // Revoke → subsequent fetch fails / access ended
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['cycleReminders', 'symptomDetails']),
      );
      await svc.revokeLink({ userId: 'owner-1', linkId: link.id });
      const stored = await svc.store.get(link.id);
      let rejected = false;
      try {
        await partnerView(stored);
      } catch (error) {
        rejected = error.code === 'CLINICAL_ACCESS_DENIED';
      }
      assert(rejected, 'revoked blocks dto');
      assert(
        shouldClearPartnerViewOnFetchFailure(403, 'CLINICAL_ACCESS_REVOKED'),
        '403 clears cache',
      );
      report.cases.revokeBlocksSubsequentFetch = { ok: true };
    }

    // Stale DTO not rendered after authorization failure
    {
      const stale = {
        cycle: { cycleDay: 10 },
        symptoms: { items: [{ id: 'x', severity: 5 }] },
      };
      const resolved = resolvePartnerViewAfterFetch({
        previousView: stale,
        fetchOk: false,
        status: 403,
        code: 'CLINICAL_ACCESS_REVOKED',
      });
      assert(resolved.view === null, 'view cleared');
      assert(resolved.errorKind === 'access_ended', 'access ended');
      assert(partnerViewSectionKeys(resolved.view).length === 0, 'no sections');
      report.cases.staleDtoClearedOnAuthFailure = { ok: true };
    }

    // No localStorage/sessionStorage in partner view hook
    {
      const source = readFileSync(
        resolve(__dirname, '../../../client/src/hooks/usePartnerView.js'),
        'utf8',
      );
      assert(!source.includes('localStorage'), 'localStorage');
      assert(!source.includes('sessionStorage'), 'sessionStorage');
      report.cases.noPersistentPartnerCache = { ok: true };
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
