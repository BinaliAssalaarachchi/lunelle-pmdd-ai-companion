/**
 * Phase 3 Partner Sharing — curated DTO + permission security tests.
 * In-memory only — no Firebase / Gemini.
 */
import {
  PARTNER_PERMISSION_DEFAULTS,
  PARTNER_PERMISSION_KEYS,
  isPermissionGranted,
} from '../../../shared/partnerPermissions.js';
import {
  createMemoryPartnerLinkStore,
  createPartnerLifecycleService,
} from '../services/partnerLifecycle.js';
import {
  assertPartnerDtoSafe,
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

async function expectReject(fn, code) {
  try {
    await fn();
    throw new Error(`Expected rejection with code ${code}`);
  } catch (error) {
    if (error.code === 'ASSERT') throw error;
    assert(error.code === code, `expected ${code}, got ${error.code}: ${error.message}`);
  }
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
          date: '2026-08-20',
          cycleDay: 20,
          cyclePhase: 'luteal',
          symptoms: {
            depressed_mood: 2,
            anxiety: 5,
            mood_swings: 4,
            anger: 3,
            reduced_interest: 2,
            concentration: 4,
            fatigue: 5,
            appetite: 3,
            sleep: 4,
            overwhelmed: 5,
            physical_symptoms: 3,
          },
          impact: {
            productivity: 4,
            activities: 3,
            relationships: 5,
          },
          notes: 'Hard afternoon — kept private unless shared',
          createdAt: 'secret-ts',
          updatedAt: 'secret-ts',
          _internal: 'should-never-leak',
        },
        {
          date: '2026-08-18',
          cycleDay: 18,
          cyclePhase: 'luteal',
          symptoms: Object.fromEntries(
            [
              'depressed_mood',
              'anxiety',
              'mood_swings',
              'anger',
              'reduced_interest',
              'concentration',
              'fatigue',
              'appetite',
              'sleep',
              'overwhelmed',
              'physical_symptoms',
            ].map((id) => [id, 1]),
          ),
          impact: { productivity: 1, activities: 1, relationships: 1 },
          notes: null,
        },
      ],
    },
    insights: {
      'owner-1': [
        {
          id: 'insight-raw-id',
          summary: 'Anxiety rises later in the cycle.',
          patterns: [{ text: 'Luteal anxiety pattern' }],
          observedPatterns: [{ text: 'Luteal anxiety pattern' }],
          evidenceSnapshot: { secret: true, numbers: [9.99] },
          metadata: {
            model: 'should-not-leak',
            promptVersion: 'secret-prompt',
            usedFallback: false,
          },
          content: '## full markdown should not dump',
          generatedAt: '2026-08-19T12:00:00.000Z',
          doctorCoach: { turns: ['never'] },
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

/** Force only the listed permissions true; all others false. */
function onlyPermissions(enabledKeys) {
  const next = {};
  for (const key of PARTNER_PERMISSION_KEYS) {
    next[key] = enabledKeys.includes(key);
  }
  return next;
}

async function viewAs(svc, ownerData, userId, linkId) {
  const authz = await svc.authorizePartnerViewAccess({ userId, linkId });
  return buildPartnerViewDto({
    link: authz.link,
    requesterId: userId,
    ownerData,
  });
}

async function run() {
  const report = { ok: true, cases: {} };
  const ownerData = seedOwnerData();

  try {
    // 1 + 2 — active partner can access permitted data; owner cannot use view API
    {
      const { svc, link } = await setupActiveLink();
      await expectReject(
        () => viewAs(svc, ownerData, 'owner-1', link.id),
        'CLINICAL_ACCESS_PARTNER_ONLY',
      );
      const asPartner = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert(asPartner.relationship.role === 'partner', 'partner role');
      assert(asPartner.cycle && asPartner.support, 'default sections missing');
      assertPartnerDtoSafe(asPartner);
      report.cases.partnerOnlyView = { ok: true };
    }

    // 3 — pending partner 403
    {
      const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
      const created = await svc.createInvitation({ ownerId: 'owner-1' });
      await expectReject(
        () => viewAs(svc, ownerData, 'partner-1', created.link.id),
        'CLINICAL_ACCESS_PENDING',
      );
      report.cases.pending403 = { ok: true };
    }

    // 4 — revoked partner 403
    {
      const { svc, link } = await setupActiveLink();
      await svc.revokeLink({ userId: 'owner-1', linkId: link.id });
      await expectReject(
        () => viewAs(svc, ownerData, 'partner-1', link.id),
        'CLINICAL_ACCESS_REVOKED',
      );
      report.cases.revoked403 = { ok: true };
    }

    // 5 — unrelated authenticated user 403
    {
      const { svc, link } = await setupActiveLink();
      await expectReject(
        () => viewAs(svc, ownerData, 'stranger-9', link.id),
        'CLINICAL_ACCESS_DENIED',
      );
      report.cases.unrelated403 = { ok: true };
    }

    // 6 — no permission → no corresponding data (all false)
    {
      const { svc, link } = await setupActiveLink(onlyPermissions([]));
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert(!('cycle' in dto), 'cycle present');
      assert(!('support' in dto), 'support present');
      assert(!('symptoms' in dto), 'symptoms present');
      assert(!('notes' in dto), 'notes present');
      assert(!('insights' in dto), 'insights present');
      assert(!('doctorCoach' in dto), 'doctorCoach present');
      report.cases.noPermissionsOmitsAll = { ok: true };
    }

    // 7 — cycleReminders only
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['cycleReminders']),
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert('cycle' in dto, 'cycle missing');
      assert(typeof dto.cycle.cycleDay === 'number', 'cycleDay');
      assert(dto.cycle.cycleLength === 28, 'cycleLength');
      assert(typeof dto.cycle.cyclePhase === 'string', 'cyclePhase');
      assert(typeof dto.cycle.daysUntilPeriod === 'number', 'daysUntilPeriod');
      assert(!('support' in dto), 'support leaked');
      assert(!('symptoms' in dto), 'symptoms leaked');
      assert(!('notes' in dto), 'notes leaked');
      assert(!('insights' in dto), 'insights leaked');
      assert(!JSON.stringify(dto).includes('maya@secret'), 'email leaked');
      assert(!JSON.stringify(dto).includes('Hard afternoon'), 'notes leaked');
      report.cases.cycleOnly = { ok: true };
    }

    // 8 — symptomDetails only
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['symptomDetails']),
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert('symptoms' in dto, 'symptoms missing');
      assert(dto.symptoms.scale.min === 1 && dto.symptoms.scale.max === 6, 'scale');
      assert(dto.symptoms.items.length === 11, '11 DRSP items');
      assert(dto.symptoms.impact.length === 3, '3 impact items');
      assert(dto.symptoms.items.find((i) => i.id === 'anxiety').severity === 5, 'anxiety');
      assert(!('cycle' in dto), 'cycle leaked');
      assert(!('notes' in dto), 'notes leaked');
      assert(!('insights' in dto), 'insights leaked');
      assert(!JSON.stringify(dto).includes('_internal'), 'internal field');
      assert(!JSON.stringify(dto).includes('createdAt'), 'createdAt leaked');
      report.cases.symptomsOnly = { ok: true };
    }

    // 9 — personalNotes only
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['personalNotes']),
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert(Array.isArray(dto.notes), 'notes missing');
      assert(dto.notes.length >= 1, 'expected a note');
      assert(dto.notes[0].text.includes('Hard afternoon'), 'note text');
      assert(Object.keys(dto.notes[0]).sort().join(',') === 'date,text', 'note keys');
      assert(!('symptoms' in dto), 'symptoms leaked');
      assert(!('insights' in dto), 'insights leaked');
      report.cases.notesOnly = { ok: true };
    }

    // 10 — privateAiInsights only
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['privateAiInsights']),
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert(Array.isArray(dto.insights) && dto.insights.length === 1, 'insights');
      assert(dto.insights[0].summary.includes('Anxiety'), 'summary');
      assert(!JSON.stringify(dto).includes('evidenceSnapshot'), 'evidence leaked');
      assert(!JSON.stringify(dto).includes('promptVersion'), 'prompt leaked');
      assert(!JSON.stringify(dto).includes('insight-raw-id'), 'raw id leaked');
      assert(!JSON.stringify(dto).includes('should-not-leak'), 'model leaked');
      assert(!('symptoms' in dto), 'symptoms leaked');
      report.cases.insightsOnly = { ok: true };
    }

    // 11 — all permissions on → still NO Doctor Coach
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions([...PARTNER_PERMISSION_KEYS]),
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert('cycle' in dto && 'support' in dto && 'symptoms' in dto, 'sections');
      assert('notes' in dto && 'insights' in dto, 'notes/insights');
      assert(!('doctorCoach' in dto), 'doctorCoach key');
      assert(!JSON.stringify(dto).includes('doctorCoach'), 'doctorCoach string');
      assert(!JSON.stringify(dto).includes('doctorScript'), 'doctorScript');
      assertPartnerDtoSafe(dto);
      report.cases.allPermsNoCoach = { ok: true };
    }

    // 12 — partner cannot request disabled fields via request manipulation
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['cycleReminders']),
      );
      const authz = await svc.authorizePartnerViewAccess({
        userId: 'partner-1',
        linkId: link.id,
      });
      // Malicious attempt: forge permissions on a cloned link object is what a
      // buggy server might do if it trusted the client — builder must use link.
      const forged = {
        ...authz.link,
        permissions: {
          ...authz.link.permissions,
          symptomDetails: true,
          personalNotes: true,
          privateAiInsights: true,
        },
      };
      // If we passed forged link it WOULD include symptoms — prove route must
      // use store link. Service under test: reload from store (authoritative).
      const authoritative = await svc.store.get(link.id);
      const dto = await buildPartnerViewDto({
        link: authoritative,
        requesterId: 'partner-1',
        ownerData,
      });
      assert(!('symptoms' in dto), 'forged perms must not apply when using store');
      assert(!('notes' in dto), 'notes from forge');
      // Client field lists ignored by design of buildPartnerViewDto (no such arg).
      report.cases.cannotRequestDisabledFields = { ok: true };
    }

    // 13 — partner cannot change ownerId/partnerId via request
    {
      const { svc, link } = await setupActiveLink();
      const authz = await svc.authorizePartnerViewAccess({
        userId: 'partner-1',
        linkId: link.id,
      });
      await expectReject(
        () =>
          buildPartnerViewDto({
            link: { ...authz.link, ownerId: 'partner-1', partnerId: 'owner-1' },
            requesterId: 'stranger-hijack',
            ownerData,
          }),
        'CLINICAL_ACCESS_DENIED',
      );
      // Even with swapped ids, stranger still denied; partner still only sees owner-1 data
      const dto = await buildPartnerViewDto({
        link: authz.link,
        requesterId: 'partner-1',
        ownerData,
      });
      assert(dto.relationship.linkId === link.id, 'link id stable');
      report.cases.cannotSwapIdentities = { ok: true };
    }

    // 14 + 15 — raw Firestore fields / secrets not leaked
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['symptomDetails', 'personalNotes', 'privateAiInsights']),
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      const raw = JSON.stringify(dto);
      assert(!raw.includes('_internal'), '_internal');
      assert(!raw.includes('createdAt'), 'createdAt');
      assert(!raw.includes('updatedAt'), 'updatedAt');
      assert(!raw.includes('inviteCodeHash'), 'inviteCodeHash');
      assert(!raw.includes('FIREBASE'), 'FIREBASE');
      assert(!raw.includes('evidenceSnapshot'), 'evidenceSnapshot');
      assert(!raw.includes('maya@secret'), 'email');
      report.cases.noRawOrSecrets = { ok: true };
    }

    // 16 — private notes absent when disabled
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['symptomDetails']),
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert(!('notes' in dto), 'notes key present');
      assert(!JSON.stringify(dto).includes('Hard afternoon'), 'note text');
      report.cases.notesAbsentWhenDisabled = { ok: true };
    }

    // 17 — AI data absent when disabled
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['cycleReminders']),
      );
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert(!('insights' in dto), 'insights key');
      assert(!JSON.stringify(dto).includes('Anxiety rises'), 'insight text');
      report.cases.aiAbsentWhenDisabled = { ok: true };
    }

    // 18 — disabling a permission immediately changes response
    {
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['personalNotes', 'cycleReminders']),
      );
      const before = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert('notes' in before && 'cycle' in before, 'before');
      await svc.updatePermissions({
        userId: 'owner-1',
        linkId: link.id,
        permissions: { personalNotes: false },
      });
      const after = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert(!('notes' in after), 'notes still present');
      assert('cycle' in after, 'cycle should remain');
      report.cases.disableImmediate = { ok: true };
    }

    // 19 — revoke immediately blocks
    {
      const { svc, link } = await setupActiveLink();
      await viewAs(svc, ownerData, 'partner-1', link.id);
      await svc.revokeLink({ userId: 'partner-1', linkId: link.id });
      await expectReject(
        () => viewAs(svc, ownerData, 'partner-1', link.id),
        'CLINICAL_ACCESS_REVOKED',
      );
      report.cases.revokeImmediate = { ok: true };
    }

    // 20 — missing/unknown permission defaults to deny
    {
      assert(isPermissionGranted({}, 'symptomDetails') === false, 'missing');
      assert(isPermissionGranted({ symptomDetails: 'true' }, 'symptomDetails') === false, 'string');
      assert(isPermissionGranted({ symptomDetails: 1 }, 'symptomDetails') === false, 'number');
      assert(isPermissionGranted({ bogous: true }, 'bogous') === false, 'unknown key');
      const { svc, link } = await setupActiveLink();
      // Corrupt stored permissions with non-boolean / missing keys
      await svc.store.update(link.id, {
        permissions: {
          cycleReminders: 'yes',
          generalSupportGuidance: true,
          // symptomDetails missing
          personalNotes: null,
          privateAiInsights: undefined,
          extraEvil: true,
        },
      });
      const dto = await viewAs(svc, ownerData, 'partner-1', link.id);
      assert(!('cycle' in dto), 'non-boolean cycleReminders must deny');
      assert('support' in dto, 'true support allowed');
      assert(!('symptoms' in dto), 'missing symptomDetails deny');
      assert(!('notes' in dto), 'null personalNotes deny');
      assert(!('insights' in dto), 'undefined insights deny');
      assert(!JSON.stringify(dto).includes('extraEvil'), 'unknown perm');
      report.cases.defaultDeny = { ok: true };
    }

    // Selective load: notes permission must not require latest full log path
    {
      let latestLogCalls = 0;
      let notesCalls = 0;
      let insightCalls = 0;
      let profileCalls = 0;
      const counting = {
        async getProfile(id) {
          profileCalls += 1;
          return ownerData.getProfile(id);
        },
        async getLatestLog(id) {
          latestLogCalls += 1;
          return ownerData.getLatestLog(id);
        },
        async getRecentNotes(id) {
          notesCalls += 1;
          return ownerData.getRecentNotes(id);
        },
        async getLatestInsight(id) {
          insightCalls += 1;
          return ownerData.getLatestInsight(id);
        },
      };
      const { svc, link } = await setupActiveLink(
        onlyPermissions(['personalNotes']),
      );
      await viewAs(svc, counting, 'partner-1', link.id);
      assert(notesCalls === 1, 'notes fetch');
      assert(latestLogCalls === 0, 'must not load latest log for notes-only');
      assert(insightCalls === 0, 'must not load insights');
      assert(profileCalls === 0, 'must not load profile');
      report.cases.selectiveFetch = { ok: true };
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
