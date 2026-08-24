/**
 * Phase 6.1 — partner connect client helpers + lifecycle transition tests.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PARTNER_ACCEPT_PATH,
  PARTNER_DECLINE_PATH,
  buildPartnerAcceptBody,
  buildPartnerDeclineBody,
  mapPartnerConnectError,
  resolveConnectPageMode,
  assertPartnerConnectSurfaceSafe,
} from '../../../client/src/lib/partnerConnectUi.js';
import {
  buildPartnerInviteLink,
  readInviteCodeFromLocation,
  PARTNER_INVITE_CODE_PARAM,
} from '../../../client/src/lib/partnerInviteLink.js';
import { resolvePartnerPostAuthPath } from '../../../client/src/lib/partnerPostAuth.js';
import {
  pickOwnerConnection,
  pickPartnerConnection,
} from '../../../client/src/lib/partnerApi.js';
import { PARTNER_PERMISSION_KEYS } from '../../../shared/partnerPermissions.js';
import {
  createMemoryPartnerLinkStore,
  createPartnerLifecycleService,
} from '../services/partnerLifecycle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'ASSERT';
    throw error;
  }
}

function readClientSource(relativePath) {
  return readFileSync(resolve(__dirname, '../../../client/src', relativePath), 'utf8');
}

async function run() {
  const report = { ok: true, cases: {} };

  try {
    // Accept endpoint + POST body
    {
      assert(PARTNER_ACCEPT_PATH === '/api/partner/accept', 'accept path');
      const body = buildPartnerAcceptBody('  secret-code-abc  ');
      assert(body.inviteCode === 'secret-code-abc', 'trimmed code');
      assert(Object.keys(body).length === 1, 'body keys');
      assert(!PARTNER_ACCEPT_PATH.includes('inviteCode'), 'code not in path');
      report.cases.acceptEndpointAndBody = { ok: true };
    }

    // Decline endpoint + POST body
    {
      assert(PARTNER_DECLINE_PATH === '/api/partner/decline', 'decline path');
      const body = buildPartnerDeclineBody('decline-code');
      assert(body.inviteCode === 'decline-code', 'decline body');
      assert(!PARTNER_DECLINE_PATH.includes('?'), 'no query on decline path');
      report.cases.declineEndpointAndBody = { ok: true };
    }

    // Invite link generation + URL code param (accept still uses POST body)
    {
      const prev = process.env.VITE_APP_URL;
      process.env.VITE_APP_URL = 'https://app.example.com';
      const link = buildPartnerInviteLink('abc-123');
      assert(
        link === 'https://app.example.com/partner/connect?code=abc-123',
        'invite link shape',
      );
      assert(
        readInviteCodeFromLocation('?code=abc-123') === 'abc-123',
        'read code from query',
      );
      assert(PARTNER_INVITE_CODE_PARAM === 'code', 'code param name');
      process.env.VITE_APP_URL = prev;
      report.cases.inviteLinkGeneration = { ok: true };
    }

    // No localStorage; sessionStorage only in partnerInviteLink for auth handoff
    {
      const sources = [
        readClientSource('lib/partnerConnectUi.js'),
        readClientSource('lib/partnerApi.js'),
        readClientSource('hooks/usePartnerConnect.js'),
        readClientSource('pages/PartnerConnect.jsx'),
        readClientSource('lib/partnerPostAuth.js'),
      ].join('\n');
      const inviteLinkSource = readClientSource('lib/partnerInviteLink.js');
      assert(!/\blocalStorage\.(get|set|remove)Item/.test(sources), 'localStorage API in connect flow');
      assert(
        inviteLinkSource.includes('sessionStorage'),
        'sessionStorage in invite link helper',
      );
      assert(!/inviteCode.*searchParams|searchParams.*inviteCode/.test(sources), 'code in fetch query');
      report.cases.noLocalPersistence = { ok: true };
    }

    // Post-auth resolver exported for login/signup redirect
    {
      assert(typeof resolvePartnerPostAuthPath === 'function', 'post auth helper');
      report.cases.postAuthHelper = { ok: true };
    }

    // Safe generic errors
    {
      assert(
        mapPartnerConnectError('INVITE_INVALID', 'Invalid invite code.') ===
          'This connection code is invalid or no longer available.',
        'invalid mapped',
      );
      assert(
        mapPartnerConnectError('INVITE_REVOKED', 'revoked') ===
          'This connection code is invalid or no longer available.',
        'revoked mapped',
      );
      assert(
        mapPartnerConnectError('INVITE_ALREADY_USED', 'used') ===
          'This connection code is invalid or no longer available.',
        'used mapped',
      );
      assert(
        mapPartnerConnectError('FIREBASE_ADMIN_MISSING', 'missing') ===
          "We couldn't connect right now. Please try again.",
        'server mapped',
      );
      const generic = mapPartnerConnectError('UNKNOWN', 'db timeout');
      assert(
        generic === "We couldn't connect right now. Please try again.",
        'fallback mapped',
      );
      report.cases.safeGenericErrors = { ok: true };
    }

    // Accept → active partner state
    {
      const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
      const created = await svc.createInvitation({ ownerId: 'owner-1' });
      const link = await svc.acceptInvitation({
        userId: 'partner-1',
        inviteCode: created.inviteCode,
      });
      assert(link.status === 'active', 'active after accept');
      assert(link.partnerId === 'partner-1', 'partner id set');
      const links = await svc.listLinksForUser('partner-1');
      assert(
        pickPartnerConnection(links, 'partner-1').state === 'active',
        'pick active',
      );
      assertPartnerConnectSurfaceSafe(link);
      report.cases.acceptToActive = { ok: true };
    }

    // Decline → revoked / disconnected state
    {
      const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
      const created = await svc.createInvitation({ ownerId: 'owner-2' });
      const declined = await svc.declineInvitation({
        userId: 'partner-2',
        inviteCode: created.inviteCode,
      });
      assert(declined.status === 'revoked', 'declined revokes link');
      const links = await svc.listLinksForUser('partner-2');
      assert(
        pickPartnerConnection(links, 'partner-2').state === 'revoked',
        'pick revoked',
      );
      report.cases.declineToRevoked = { ok: true };
    }

    // Invalid / revoked codes — lifecycle rejects (client maps generically)
    {
      const svc = createPartnerLifecycleService(createMemoryPartnerLinkStore());
      const created = await svc.createInvitation({ ownerId: 'owner-3' });
      await svc.revokeLink({ userId: 'owner-3', linkId: created.link.id });
      let code = null;
      try {
        await svc.acceptInvitation({
          userId: 'partner-3',
          inviteCode: created.inviteCode,
        });
      } catch (error) {
        code = error.code;
      }
      assert(code === 'INVITE_INVALID', 'revoked code invalid');
      assert(
        mapPartnerConnectError(code, '') ===
          'This connection code is invalid or no longer available.',
        'client hides detail',
      );
      report.cases.invalidCodeRejected = { ok: true };
    }

    // Page mode resolution
    {
      const partner = 'partner-x';
      const owner = 'owner-x';
      assert(
        resolveConnectPageMode({
          links: [{ ownerId: owner, partnerId: partner, status: 'active', id: '1' }],
          userId: partner,
          ownerConnection: pickOwnerConnection([], partner),
          partnerConnection: pickPartnerConnection(
            [{ ownerId: owner, partnerId: partner, status: 'active', id: '1' }],
            partner,
          ),
        }) === 'already_active',
        'active partner redirects',
      );
      assert(
        resolveConnectPageMode({
          links: [{ ownerId: owner, status: 'pending', id: '1' }],
          userId: owner,
          ownerConnection: pickOwnerConnection(
            [{ ownerId: owner, status: 'pending', id: '1' }],
            owner,
          ),
          partnerConnection: pickPartnerConnection([], owner),
        }) === 'owner_manage',
        'owner pending manages profile',
      );
      assert(
        resolveConnectPageMode({
          links: [],
          userId: 'new-partner',
          ownerConnection: pickOwnerConnection([], 'new-partner'),
          partnerConnection: pickPartnerConnection([], 'new-partner'),
        }) === 'form',
        'disconnected shows form',
      );
      report.cases.connectPageModes = { ok: true };
    }

    // No Doctor Coach keys or new permissions introduced
    {
      const connectPage = readClientSource('pages/PartnerConnect.jsx');
      const hook = readClientSource('hooks/usePartnerConnect.js');
      const combined = `${connectPage}\n${hook}`;
      assert(!/"doctorCoach"\s*:/.test(combined), 'doctorCoach object key in connect flow');
      assert(!/"coach"\s*:/.test(combined), 'coach object key in connect flow');
      for (const key of PARTNER_PERMISSION_KEYS) {
        assert(!new RegExp(`${key}\\s*:`).test(connectPage), `${key} in connect page`);
      }
      report.cases.noCoachOrNewPermissions = { ok: true };
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
