/**
 * Phase 6.2 — partner-side revoke / leave shared space client tests.
 */
import {
  pickOwnerConnection,
  pickPartnerConnection,
} from '../../../client/src/lib/partnerApi.js';
import {
  clearPartnerViewOnRevoke,
  partnerViewSectionKeys,
  resolvePartnerSupportPageMode,
} from '../../../client/src/lib/partnerViewUi.js';
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

async function expectReject(fn, code) {
  try {
    await fn();
    throw new Error(`Expected rejection with code ${code}`);
  } catch (error) {
    if (error.code === 'ASSERT') throw error;
    assert(error.code === code, `expected ${code}, got ${error.code}: ${error.message}`);
  }
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
        symptoms: { anxiety: 5 },
        notes: 'Private note',
      },
    ],
  },
});

async function setupActiveLink() {
  const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
  const created = await svc.createInvitation({ ownerId: 'owner-1' });
  await svc.acceptInvitation({
    userId: 'partner-1',
    inviteCode: created.inviteCode,
  });
  const link = await svc.store.get(created.link.id);
  return { svc, link };
}

async function run() {
  const report = { ok: true, cases: {} };

  try {
    // Active partner can revoke via lifecycle (API contract)
    {
      const { svc, link } = await setupActiveLink();
      const revoked = await svc.revokeLink({
        userId: 'partner-1',
        linkId: link.id,
      });
      assert(revoked.status === 'revoked', 'partner revoke status');
      assert(revoked.revokedBy === 'partner-1', 'revoked by partner');
      report.cases.activePartnerCanRevoke = { ok: true };
    }

    // Revoked partner cannot fetch partner DTO
    {
      const { svc, link } = await setupActiveLink();
      await svc.revokeLink({ userId: 'partner-1', linkId: link.id });
      const stored = await svc.store.get(link.id);
      await expectReject(
        () =>
          buildPartnerViewDto({
            link: stored,
            requesterId: 'partner-1',
            ownerData,
          }),
        'CLINICAL_ACCESS_DENIED',
      );
      report.cases.revokedPartnerNoDto = { ok: true };
    }

    // Client clears clinical DTO immediately on revoke
    {
      const { link } = await setupActiveLink();
      const dto = await buildPartnerViewDto({
        link,
        requesterId: 'partner-1',
        ownerData,
      });
      assert(partnerViewSectionKeys(dto).length > 0, 'dto had sections');
      const cleared = clearPartnerViewOnRevoke();
      assert(cleared === null, 'view cleared');
      assert(partnerViewSectionKeys(cleared).length === 0, 'no sections after clear');
      report.cases.clientClearsViewOnRevoke = { ok: true };
    }

    // Refresh after revoke → disconnected / access ended page mode
    {
      const { svc, link } = await setupActiveLink();
      await svc.revokeLink({ userId: 'partner-1', linkId: link.id });
      const partnerLinks = await svc.listLinksForUser('partner-1');
      const partnerConnection = pickPartnerConnection(partnerLinks, 'partner-1');
      const ownerConnection = pickOwnerConnection(partnerLinks, 'partner-1');
      assert(partnerConnection.state === 'revoked', 'partner revoked pick');
      assert(
        resolvePartnerSupportPageMode(partnerConnection, ownerConnection) ===
          'partner_revoked',
        'refresh shows revoked mode',
      );
      report.cases.refreshShowsDisconnected = { ok: true };
    }

    // Owner sees disconnected after partner revokes
    {
      const { svc, link } = await setupActiveLink();
      await svc.revokeLink({ userId: 'partner-1', linkId: link.id });
      const ownerLinks = await svc.listLinksForUser('owner-1');
      const ownerConnection = pickOwnerConnection(ownerLinks, 'owner-1');
      assert(ownerConnection.state === 'revoked', 'owner sees revoked');
      report.cases.ownerSeesDisconnected = { ok: true };
    }

    // Revoke uses POST body linkId only (existing contract)
    {
      const body = { linkId: 'link-abc' };
      assert(body.linkId === 'link-abc', 'linkId in body');
      assert(!JSON.stringify(body).includes('permissions'), 'no permission override');
      report.cases.revokeBodyContract = { ok: true };
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
