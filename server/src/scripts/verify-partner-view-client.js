/**
 * Phase 5 partner view — client helpers + DTO section security tests.
 */
import {
  assertPartnerViewDtoClientSafe,
  buildPartnerViewRequestUrl,
  partnerViewSectionKeys,
} from '../../../client/src/lib/partnerViewUi.js';
import { pickPartnerConnection } from '../../../client/src/lib/partnerApi.js';
import {
  createMemoryPartnerLinkStore,
  createPartnerLifecycleService,
} from '../services/partnerLifecycle.js';
import {
  buildPartnerViewDto,
  createMemoryPartnerOwnerData,
} from '../services/partnerView.js';

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

async function activePartnerLink(permissions) {
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
  return svc.store.get(created.link.id);
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
        cycleDay: 20,
        cyclePhase: 'luteal',
        symptoms: {
          anxiety: 5,
          depressed_mood: 2,
          mood_swings: 3,
          anger: 2,
          reduced_interest: 2,
          concentration: 3,
          fatigue: 4,
          appetite: 2,
          sleep: 3,
          overwhelmed: 4,
          physical_symptoms: 2,
        },
        impact: { productivity: 3, activities: 2, relationships: 4 },
        notes: 'Shared note',
      },
    ],
  },
  insights: {
    'owner-1': [
      {
        summary: 'Pattern insight',
        patterns: [{ text: 'Luteal window' }],
        generatedAt: '2026-08-19T12:00:00.000Z',
        evidenceSnapshot: { secret: true },
        metadata: { model: 'hidden' },
      },
    ],
  },
});

async function partnerDto(permissions) {
  const link = await activePartnerLink(onlyPermissions(permissions));
  return buildPartnerViewDto({
    link,
    requesterId: 'partner-1',
    ownerData,
  });
}

async function run() {
  const report = { ok: true, cases: {} };

  try {
    // View URL uses linkId only
    {
      const url = buildPartnerViewRequestUrl('link-abc');
      assert(url === '/api/partner/view?linkId=link-abc', url);
      assert(!url.includes('permissions'), 'permissions in url');
      assert(!url.includes('fields'), 'fields in url');
      report.cases.viewUrlLinkIdOnly = { ok: true };
    }

    // 1 cycle when enabled
    {
      const dto = await partnerDto(['cycleReminders']);
      assert(partnerViewSectionKeys(dto).includes('cycle'), 'cycle missing');
      assert(!('symptoms' in dto), 'symptoms leaked');
      report.cases.cycleWhenEnabled = { ok: true };
    }

    // 2 no cycle when disabled
    {
      const dto = await partnerDto(['generalSupportGuidance']);
      assert(!('cycle' in dto), 'cycle present');
      report.cases.cycleWhenDisabled = { ok: true };
    }

    // 3 support only when enabled
    {
      const on = await partnerDto(['generalSupportGuidance']);
      const off = await partnerDto([]);
      assert('support' in on, 'support on');
      assert(!('support' in off), 'support off');
      report.cases.supportGated = { ok: true };
    }

    // 4 symptoms only when enabled
    {
      const on = await partnerDto(['symptomDetails']);
      const off = await partnerDto(['cycleReminders']);
      assert('symptoms' in on, 'symptoms on');
      assert(!('symptoms' in off), 'symptoms off');
      report.cases.symptomsGated = { ok: true };
    }

    // 5 notes only when enabled
    {
      const on = await partnerDto(['personalNotes']);
      const off = await partnerDto(['cycleReminders']);
      assert('notes' in on, 'notes on');
      assert(!('notes' in off), 'notes off');
      report.cases.notesGated = { ok: true };
    }

    // 6 insights only when enabled
    {
      const on = await partnerDto(['privateAiInsights']);
      const off = await partnerDto(['cycleReminders']);
      assert('insights' in on, 'insights on');
      assert(!('insights' in off), 'insights off');
      assert(!JSON.stringify(on).includes('evidenceSnapshot'), 'evidence');
      report.cases.insightsGated = { ok: true };
    }

    // 7 no Doctor Coach ever
    {
      const dto = await partnerDto([
        'cycleReminders',
        'generalSupportGuidance',
        'symptomDetails',
        'personalNotes',
        'privateAiInsights',
      ]);
      assert(!('doctorCoach' in dto), 'doctorCoach key');
      assertPartnerViewDtoClientSafe(dto);
      report.cases.noCoach = { ok: true };
    }

    // 8 — owner cannot fetch partner DTO; partner role succeeds
    {
      const link = await activePartnerLink(['cycleReminders']);
      let ownerRejected = false;
      try {
        await buildPartnerViewDto({
          link,
          requesterId: 'owner-1',
          ownerData,
        });
      } catch (error) {
        ownerRejected = error.code === 'CLINICAL_ACCESS_PARTNER_ONLY';
      }
      assert(ownerRejected, 'owner must be rejected');
      const partnerDtoResult = await buildPartnerViewDto({
        link,
        requesterId: 'partner-1',
        ownerData,
      });
      assert(partnerDtoResult.relationship.role === 'partner', 'partner role');
      report.cases.partnerOnlyDto = { ok: true };
    }

    // 9 revoked — no dto (403 at API)
    {
      const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
      const created = await svc.createInvitation({ ownerId: 'owner-1' });
      await svc.acceptInvitation({
        userId: 'partner-1',
        inviteCode: created.inviteCode,
      });
      await svc.revokeLink({ userId: 'owner-1', linkId: created.link.id });
      const link = await svc.store.get(created.link.id);
      let rejected = false;
      try {
        await buildPartnerViewDto({
          link,
          requesterId: 'partner-1',
          ownerData,
        });
      } catch (error) {
        rejected = error.code === 'CLINICAL_ACCESS_DENIED';
      }
      assert(rejected, 'revoked must reject');
      report.cases.revokedNoContent = { ok: true };
    }

    // 10 pending — no dto
    {
      const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
      const created = await svc.createInvitation({ ownerId: 'owner-1' });
      const link = await svc.store.get(created.link.id);
      let rejected = false;
      try {
        await buildPartnerViewDto({
          link,
          requesterId: 'partner-1',
          ownerData,
        });
      } catch (error) {
        rejected = error.status === 403;
      }
      assert(rejected, 'pending must reject');
      report.cases.pendingNoContent = { ok: true };
    }

    // 11 unrelated user
    {
      const link = await activePartnerLink(['cycleReminders']);
      let rejected = false;
      try {
        await buildPartnerViewDto({
          link,
          requesterId: 'stranger',
          ownerData,
        });
      } catch (error) {
        rejected = error.code === 'CLINICAL_ACCESS_DENIED';
      }
      assert(rejected, 'stranger rejected');
      report.cases.unrelatedBlocked = { ok: true };
    }

    // pickPartnerConnection states
    {
      const owner = 'owner-1';
      const partner = 'partner-1';
      assert(
        pickPartnerConnection(
          [{ ownerId: owner, partnerId: partner, status: 'active', id: 'x' }],
          partner,
        ).state === 'active',
        'active pick',
      );
      assert(
        pickPartnerConnection(
          [{ ownerId: owner, partnerId: partner, status: 'pending', id: 'x' }],
          partner,
        ).state === 'pending',
        'pending pick',
      );
      report.cases.pickPartnerConnection = { ok: true };
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
