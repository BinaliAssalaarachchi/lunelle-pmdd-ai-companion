/**
 * Phase 2 Partner Sharing — lifecycle + authorization (no clinical payload, no UI).
 * Uses in-memory store — no Firebase / Gemini required.
 */
import {
  PARTNER_PERMISSION_DEFAULTS,
  isPermissionGranted,
  normalizePartnerPermissions,
} from '../../../shared/partnerPermissions.js';
import {
  createMemoryPartnerLinkStore,
  createPartnerLifecycleService,
  hashInviteCode,
  sanitizeLinkForClient,
} from '../services/partnerLifecycle.js';

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

function createService() {
  return createPartnerLifecycleService(createMemoryPartnerLinkStore());
}

async function run() {
  const report = { ok: true, cases: {} };

  try {
    // --- valid invitation ---
    {
      const svc = createService();
      const { link, inviteCode } = await svc.createInvitation({
        ownerId: 'owner-1',
        partnerEmail: 'partner@example.com',
      });
      assert(link.status === 'pending', 'invite not pending');
      assert(link.ownerId === 'owner-1', 'owner mismatch');
      assert(link.partnerId === null, 'partner should be null until accept');
      assert(typeof inviteCode === 'string' && inviteCode.length >= 32, 'weak invite code');
      assert(!JSON.stringify(link).includes(inviteCode), 'invite code leaked in link');
      assert(
        link.permissions.cycleReminders === true &&
          link.permissions.generalSupportGuidance === true &&
          link.permissions.symptomDetails === false &&
          link.permissions.personalNotes === false &&
          link.permissions.privateAiInsights === false,
        'default permissions wrong',
      );
      const stored = await svc.store.get(link.id);
      assert(stored.inviteCodeHash === hashInviteCode(inviteCode), 'hash mismatch');
      assert(!Object.values(stored).includes(inviteCode), 'plaintext code stored');
      report.cases.validInvitation = { ok: true };
    }

    // --- invalid invite ---
    {
      const svc = createService();
      await svc.createInvitation({ ownerId: 'owner-1' });
      await expectReject(
        () => svc.acceptInvitation({ userId: 'partner-1', inviteCode: 'totally-bogus' }),
        'INVITE_INVALID',
      );
      await expectReject(
        () => svc.acceptInvitation({ userId: 'partner-1', inviteCode: '' }),
        'INVITE_CODE_REQUIRED',
      );
      report.cases.invalidInvite = { ok: true };
    }

    // --- self-invite ---
    {
      const svc = createService();
      await expectReject(
        () =>
          svc.createInvitation({
            ownerId: 'owner-1',
            partnerId: 'owner-1',
          }),
        'SELF_INVITE',
      );
      const { inviteCode } = await svc.createInvitation({ ownerId: 'owner-1' });
      await expectReject(
        () => svc.acceptInvitation({ userId: 'owner-1', inviteCode }),
        'SELF_INVITE',
      );
      report.cases.selfInvite = { ok: true };
    }

    // --- accept invitation ---
    {
      const svc = createService();
      const { link, inviteCode } = await svc.createInvitation({ ownerId: 'owner-1' });
      const accepted = await svc.acceptInvitation({
        userId: 'partner-1',
        inviteCode,
      });
      assert(accepted.status === 'active', 'not active');
      assert(accepted.partnerId === 'partner-1', 'partner not bound');
      assert(accepted.id === link.id, 'link id changed');
      report.cases.acceptInvitation = { ok: true };
    }

    // --- decline invitation ---
    {
      const svc = createService();
      const { inviteCode } = await svc.createInvitation({ ownerId: 'owner-1' });
      const declined = await svc.declineInvitation({
        userId: 'partner-2',
        inviteCode,
      });
      assert(declined.status === 'revoked', 'decline should revoke');
      await expectReject(
        () => svc.acceptInvitation({ userId: 'partner-2', inviteCode }),
        'INVITE_INVALID',
      );
      report.cases.declineInvitation = { ok: true };
    }

    // --- already-used invitation ---
    {
      const svc = createService();
      const { inviteCode } = await svc.createInvitation({ ownerId: 'owner-1' });
      await svc.acceptInvitation({ userId: 'partner-1', inviteCode });
      await expectReject(
        () => svc.acceptInvitation({ userId: 'partner-2', inviteCode }),
        'INVITE_INVALID',
      );
      report.cases.alreadyUsedInvitation = { ok: true };
    }

    // --- revoked invitation ---
    {
      const svc = createService();
      const { link, inviteCode } = await svc.createInvitation({ ownerId: 'owner-1' });
      await svc.revokeLink({ userId: 'owner-1', linkId: link.id });
      // Invite code hash is rotated on revoke — code must fail closed.
      await expectReject(
        () => svc.acceptInvitation({ userId: 'partner-1', inviteCode }),
        'INVITE_INVALID',
      );
      const stored = await svc.store.get(link.id);
      assert(stored.status === 'revoked', 'link not revoked');
      report.cases.revokedInvitation = { ok: true };
    }

    // --- owner permission update ---
    {
      const svc = createService();
      const { link } = await svc.createInvitation({ ownerId: 'owner-1' });
      const updated = await svc.updatePermissions({
        userId: 'owner-1',
        linkId: link.id,
        permissions: {
          symptomDetails: true,
          personalNotes: true,
          bogusFlag: true,
        },
      });
      assert(updated.permissions.symptomDetails === true, 'symptomDetails not on');
      assert(updated.permissions.personalNotes === true, 'personalNotes not on');
      assert(
        updated.permissions.privateAiInsights === false,
        'privateAiInsights should stay default false',
      );
      assert(
        !Object.prototype.hasOwnProperty.call(updated.permissions, 'bogusFlag'),
        'unknown permission leaked',
      );
      assert(
        isPermissionGranted({ symptomDetails: 'yes' }, 'symptomDetails') === false,
        'default-deny failed for non-boolean',
      );
      assert(
        isPermissionGranted({}, 'symptomDetails') === false,
        'default-deny failed for missing',
      );
      report.cases.ownerPermissionUpdate = { ok: true };
    }

    // --- partner attempting permission escalation ---
    {
      const svc = createService();
      const { link, inviteCode } = await svc.createInvitation({ ownerId: 'owner-1' });
      await svc.acceptInvitation({ userId: 'partner-1', inviteCode });
      await expectReject(
        () =>
          svc.updatePermissions({
            userId: 'partner-1',
            linkId: link.id,
            permissions: { symptomDetails: true, privateAiInsights: true },
          }),
        'PERMISSIONS_OWNER_ONLY',
      );
      const current = await svc.store.get(link.id);
      assert(current.permissions.symptomDetails === false, 'partner escalated');
      report.cases.partnerPermissionEscalation = { ok: true };
    }

    // --- either side revoking ---
    {
      const svcOwner = createService();
      const a = await svcOwner.createInvitation({ ownerId: 'owner-1' });
      await svcOwner.acceptInvitation({
        userId: 'partner-1',
        inviteCode: a.inviteCode,
      });
      const revokedByOwner = await svcOwner.revokeLink({
        userId: 'owner-1',
        linkId: a.link.id,
      });
      assert(revokedByOwner.status === 'revoked', 'owner revoke failed');

      const svcPartner = createService();
      const b = await svcPartner.createInvitation({ ownerId: 'owner-2' });
      await svcPartner.acceptInvitation({
        userId: 'partner-2',
        inviteCode: b.inviteCode,
      });
      const revokedByPartner = await svcPartner.revokeLink({
        userId: 'partner-2',
        linkId: b.link.id,
      });
      assert(revokedByPartner.status === 'revoked', 'partner revoke failed');

      // cannot reactivate
      await expectReject(
        () =>
          svcPartner.updatePermissions({
            userId: 'owner-2',
            linkId: b.link.id,
            permissions: { symptomDetails: true },
          }),
        'LINK_REVOKED',
      );
      report.cases.eitherSideRevoking = { ok: true };
    }

    // --- revoked user attempting clinical access ---
    {
      const svc = createService();
      const { link, inviteCode } = await svc.createInvitation({ ownerId: 'owner-1' });
      await svc.acceptInvitation({ userId: 'partner-1', inviteCode });
      await svc.revokeLink({ userId: 'owner-1', linkId: link.id });
      await expectReject(
        () =>
          svc.assertPartnerClinicalAccess({
            userId: 'partner-1',
            linkId: link.id,
          }),
        'CLINICAL_ACCESS_REVOKED',
      );
      report.cases.revokedClinicalAccess = { ok: true };
    }

    // --- pending user attempting clinical access ---
    {
      const svc = createService();
      const { link } = await svc.createInvitation({ ownerId: 'owner-1' });
      await expectReject(
        () =>
          svc.assertPartnerClinicalAccess({
            userId: 'partner-1',
            linkId: link.id,
          }),
        'CLINICAL_ACCESS_PENDING',
      );
      // Even the owner cannot use the partner clinical gate as partner
      await expectReject(
        () =>
          svc.assertPartnerClinicalAccess({
            userId: 'owner-1',
            linkId: link.id,
          }),
        'CLINICAL_ACCESS_PENDING',
      );
      report.cases.pendingClinicalAccess = { ok: true };
    }

    // --- account deletion revoking relationships ---
    {
      const svc = createService();
      const a = await svc.createInvitation({ ownerId: 'owner-del' });
      await svc.acceptInvitation({
        userId: 'partner-del',
        inviteCode: a.inviteCode,
      });
      const b = await svc.createInvitation({ ownerId: 'other-owner' });
      await svc.acceptInvitation({
        userId: 'owner-del',
        inviteCode: b.inviteCode,
      });
      const result = await svc.revokeAllLinksForUser('owner-del');
      assert(result.revoked === 2, `expected 2 revoked, got ${result.revoked}`);
      const links = await svc.listLinksForUser('owner-del');
      assert(
        links.every((item) => item.status === 'revoked'),
        'not all links revoked',
      );
      await expectReject(
        () =>
          svc.assertPartnerClinicalAccess({
            userId: 'partner-del',
            linkId: a.link.id,
          }),
        'CLINICAL_ACCESS_REVOKED',
      );
      report.cases.accountDeletionRevokes = { ok: true };
    }

    // --- sanitize never includes invite hash or coach fields ---
    {
      const defaults = normalizePartnerPermissions(null);
      assert(
        JSON.stringify(defaults) === JSON.stringify(PARTNER_PERMISSION_DEFAULTS),
        'defaults drifted',
      );
      const sanitized = sanitizeLinkForClient({
        id: 'x',
        ownerId: 'o',
        partnerId: 'p',
        inviteCodeHash: 'secret-hash',
        status: 'active',
        permissions: defaults,
        doctorCoach: { turns: ['should never appear'] },
      });
      assert(!('inviteCodeHash' in sanitized), 'hash leaked to client');
      assert(!('doctorCoach' in sanitized), 'coach field leaked');
      report.cases.sanitizeNoSecrets = { ok: true };
    }

    // --- active partner can pass clinical gate; owner cannot ---
    {
      const svc = createService();
      const { link, inviteCode } = await svc.createInvitation({ ownerId: 'owner-1' });
      await svc.acceptInvitation({ userId: 'partner-1', inviteCode });
      const gatePartner = await svc.assertPartnerClinicalAccess({
        userId: 'partner-1',
        linkId: link.id,
      });
      assert(gatePartner.role === 'partner', 'partner role');
      assert(gatePartner.link.status === 'active', 'active link');
      await expectReject(
        () =>
          svc.assertPartnerClinicalAccess({
            userId: 'owner-1',
            linkId: link.id,
          }),
        'CLINICAL_ACCESS_PARTNER_ONLY',
      );
      await expectReject(
        () =>
          svc.assertPartnerClinicalAccess({
            userId: 'stranger',
            linkId: link.id,
          }),
        'CLINICAL_ACCESS_DENIED',
      );
      report.cases.partnerOnlyClinicalGate = { ok: true };
    }

    // --- one open invitation per owner (Phase 6.4) ---
    {
      const svc = createService();
      const first = await svc.createInvitation({
        ownerId: 'owner-open',
        partnerEmail: 'first@example.com',
      });
      assert(first.link.status === 'pending', 'first invite pending');
      report.cases.firstInvitationSucceeds = { ok: true };
    }

    {
      const svc = createService();
      const first = await svc.createInvitation({ ownerId: 'owner-dup-pending' });
      await expectReject(
        () => svc.createInvitation({ ownerId: 'owner-dup-pending' }),
        'LINK_ALREADY_OPEN',
      );
      const stored = await svc.store.get(first.link.id);
      assert(stored.status === 'pending', 'pending link unchanged');
      assert(stored.partnerEmail === first.link.partnerEmail, 'email unchanged');
      const all = await svc.store.listOpenForOwner('owner-dup-pending');
      assert(all.length === 1, 'only one open link');
      report.cases.duplicateWhilePending = { ok: true };
    }

    {
      const svc = createService();
      const created = await svc.createInvitation({ ownerId: 'owner-dup-active' });
      await svc.acceptInvitation({
        userId: 'partner-active',
        inviteCode: created.inviteCode,
      });
      await expectReject(
        () => svc.createInvitation({ ownerId: 'owner-dup-active' }),
        'LINK_ALREADY_OPEN',
      );
      const stored = await svc.store.get(created.link.id);
      assert(stored.status === 'active', 'active link unchanged');
      report.cases.duplicateWhileActive = { ok: true };
    }

    {
      const svc = createService();
      const created = await svc.createInvitation({ ownerId: 'owner-reinvite' });
      await svc.revokeLink({ userId: 'owner-reinvite', linkId: created.link.id });
      const second = await svc.createInvitation({ ownerId: 'owner-reinvite' });
      assert(second.link.status === 'pending', 'new invite after revoke');
      assert(second.link.id !== created.link.id, 'new link id');
      report.cases.inviteAfterRevoke = { ok: true };
    }

    {
      const svc = createService();
      const created = await svc.createInvitation({
        ownerId: 'owner-safe-err',
        partnerEmail: 'secret-partner@example.com',
      });
      let caught = null;
      try {
        await svc.createInvitation({ ownerId: 'owner-safe-err' });
      } catch (error) {
        caught = error;
      }
      assert(caught?.code === 'LINK_ALREADY_OPEN', 'link already open code');
      const payload = JSON.stringify({
        error: caught.message,
        code: caught.code,
      });
      assert(!payload.includes(created.inviteCode), 'invite code leaked');
      assert(!payload.includes('secret-partner@example.com'), 'email leaked');
      assert(!payload.includes(created.link.id), 'link id leaked');
      assert(!payload.includes('partnerId'), 'partner id key leaked');
      report.cases.noSensitiveErrorLeak = { ok: true };
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
