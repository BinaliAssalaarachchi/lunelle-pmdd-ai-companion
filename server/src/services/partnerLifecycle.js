import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  normalizePartnerPermissions,
  mergePartnerPermissionUpdates,
  publicPermissions,
} from '../../../shared/partnerPermissions.js';

export const PARTNER_LINKS_COLLECTION = 'partnerLinks';

export function generateInviteCode() {
  return randomBytes(32).toString('base64url');
}

export function hashInviteCode(code) {
  return createHash('sha256')
    .update(String(code || ''), 'utf8')
    .digest('hex');
}

export function inviteCodesEqual(plainCode, storedHash) {
  if (!plainCode || !storedHash || typeof storedHash !== 'string') return false;
  const a = Buffer.from(hashInviteCode(plainCode), 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function nowIso() {
  return new Date().toISOString();
}

function makeError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

/** Strip secrets before returning link metadata to clients. */
export function sanitizeLinkForClient(link) {
  if (!link) return null;
  return {
    id: link.id,
    ownerId: link.ownerId,
    partnerId: link.partnerId ?? null,
    partnerEmail: link.partnerEmail ?? null,
    status: link.status,
    permissions: publicPermissions(link.permissions),
    createdAt: link.createdAt ?? null,
    updatedAt: link.updatedAt ?? null,
    acceptedAt: link.acceptedAt ?? null,
    revokedAt: link.revokedAt ?? null,
    revokedBy: link.revokedBy ?? null,
  };
}

/**
 * In-memory store for tests. Mimics the subset of Firestore ops we need.
 */
export function createMemoryPartnerLinkStore() {
  const docs = new Map();
  let seq = 0;

  return {
    async create(data) {
      const id = `link_${++seq}`;
      const doc = { id, ...data };
      docs.set(id, doc);
      return { ...doc };
    },
    async get(id) {
      const doc = docs.get(id);
      return doc ? { ...doc } : null;
    },
    async update(id, patch) {
      const current = docs.get(id);
      if (!current) return null;
      const next = { ...current, ...patch };
      docs.set(id, next);
      return { ...next };
    },
    async findByInviteCodeHash(inviteCodeHash) {
      for (const doc of docs.values()) {
        if (doc.inviteCodeHash === inviteCodeHash) return { ...doc };
      }
      return null;
    },
    async listForUser(userId) {
      return [...docs.values()]
        .filter((doc) => doc.ownerId === userId || doc.partnerId === userId)
        .map((doc) => ({ ...doc }));
    },
    async listRelatedToUser(userId) {
      return this.listForUser(userId);
    },
    async listOpenForOwner(ownerId) {
      return [...docs.values()]
        .filter(
          (doc) =>
            doc.ownerId === ownerId &&
            (doc.status === 'pending' || doc.status === 'active'),
        )
        .map((doc) => ({ ...doc }));
    },
  };
}

/**
 * Firestore-backed store (Admin SDK).
 */
export function createFirestorePartnerLinkStore(db) {
  const col = () => db.collection(PARTNER_LINKS_COLLECTION);

  return {
    async create(data) {
      const ref = col().doc();
      const doc = { id: ref.id, ...data };
      const { id, ...fields } = doc;
      await ref.set(fields);
      return doc;
    },
    async get(id) {
      const snap = await col().doc(id).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    },
    async update(id, patch) {
      const ref = col().doc(id);
      await ref.update(patch);
      const snap = await ref.get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    },
    async findByInviteCodeHash(inviteCodeHash) {
      const snap = await col()
        .where('inviteCodeHash', '==', inviteCodeHash)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() };
    },
    async listForUser(userId) {
      const [asOwner, asPartner] = await Promise.all([
        col().where('ownerId', '==', userId).get(),
        col().where('partnerId', '==', userId).get(),
      ]);
      const map = new Map();
      for (const doc of asOwner.docs) {
        map.set(doc.id, { id: doc.id, ...doc.data() });
      }
      for (const doc of asPartner.docs) {
        map.set(doc.id, { id: doc.id, ...doc.data() });
      }
      return [...map.values()];
    },
    async listRelatedToUser(userId) {
      return this.listForUser(userId);
    },
    async listOpenForOwner(ownerId) {
      const snap = await col()
        .where('ownerId', '==', ownerId)
        .where('status', 'in', ['pending', 'active'])
        .get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
  };
}

export function createPartnerLifecycleService(store) {
  async function assertOwnerMayCreateInvitation(ownerId) {
    const open = await store.listOpenForOwner(ownerId);
    if (open.length > 0) {
      throw makeError(
        'You already have an open partner invitation or connection. Revoke it before sending a new one.',
        'LINK_ALREADY_OPEN',
        409,
      );
    }
  }

  async function createInvitation({
    ownerId,
    partnerEmail = null,
    partnerId = null,
  } = {}) {
    if (!ownerId || typeof ownerId !== 'string') {
      throw makeError('Owner is required.', 'OWNER_REQUIRED', 400);
    }

    if (partnerId && partnerId === ownerId) {
      throw makeError(
        'You cannot invite yourself as a partner.',
        'SELF_INVITE',
        400,
      );
    }

    const email =
      typeof partnerEmail === 'string' && partnerEmail.trim()
        ? partnerEmail.trim().toLowerCase().slice(0, 320)
        : null;

    await assertOwnerMayCreateInvitation(ownerId);

    const inviteCode = generateInviteCode();
    const createdAt = nowIso();
    const doc = await store.create({
      ownerId,
      partnerId: partnerId || null,
      partnerEmail: email,
      inviteCodeHash: hashInviteCode(inviteCode),
      status: 'pending',
      permissions: normalizePartnerPermissions(null),
      createdAt,
      updatedAt: createdAt,
      acceptedAt: null,
      revokedAt: null,
      revokedBy: null,
    });

    return {
      link: sanitizeLinkForClient(doc),
      // Returned once — never stored in plaintext, never logged by callers.
      inviteCode,
    };
  }

  async function acceptInvitation({ userId, inviteCode } = {}) {
    if (!userId) {
      throw makeError('Authentication required.', 'AUTH_REQUIRED', 401);
    }
    const code = String(inviteCode || '').trim();
    if (!code) {
      throw makeError('Invite code is required.', 'INVITE_CODE_REQUIRED', 400);
    }

    const link = await store.findByInviteCodeHash(hashInviteCode(code));
    if (!link || !inviteCodesEqual(code, link.inviteCodeHash)) {
      throw makeError('Invalid invite code.', 'INVITE_INVALID', 404);
    }
    if (link.status === 'revoked') {
      throw makeError('This invitation has been revoked.', 'INVITE_REVOKED', 410);
    }
    if (link.status === 'active') {
      throw makeError(
        'This invitation has already been used.',
        'INVITE_ALREADY_USED',
        409,
      );
    }
    if (link.status !== 'pending') {
      throw makeError('Invitation is not available.', 'INVITE_UNAVAILABLE', 409);
    }
    if (link.ownerId === userId) {
      throw makeError(
        'You cannot accept your own invitation.',
        'SELF_INVITE',
        400,
      );
    }
    if (link.partnerId && link.partnerId !== userId) {
      throw makeError(
        'This invitation is for another user.',
        'INVITE_WRONG_USER',
        403,
      );
    }

    const updatedAt = nowIso();
    const updated = await store.update(link.id, {
      partnerId: userId,
      status: 'active',
      acceptedAt: updatedAt,
      updatedAt,
      // Invalidate further redeem attempts by rotating the hash to a dead value.
      inviteCodeHash: hashInviteCode(`used:${link.id}:${updatedAt}`),
    });

    return sanitizeLinkForClient(updated);
  }

  async function declineInvitation({ userId, inviteCode, linkId } = {}) {
    if (!userId) {
      throw makeError('Authentication required.', 'AUTH_REQUIRED', 401);
    }

    let link = null;
    if (linkId) {
      link = await store.get(linkId);
    } else if (inviteCode) {
      const code = String(inviteCode || '').trim();
      link = await store.findByInviteCodeHash(hashInviteCode(code));
      if (link && !inviteCodesEqual(code, link.inviteCodeHash)) {
        link = null;
      }
    }

    if (!link) {
      throw makeError('Invitation not found.', 'INVITE_INVALID', 404);
    }
    if (link.status === 'revoked') {
      throw makeError('This invitation is already closed.', 'INVITE_REVOKED', 410);
    }
    if (link.status !== 'pending') {
      throw makeError(
        'Only pending invitations can be declined.',
        'INVITE_NOT_PENDING',
        409,
      );
    }
    if (link.ownerId === userId) {
      throw makeError(
        'Owners should revoke instead of decline.',
        'OWNER_USE_REVOKE',
        400,
      );
    }
    // Pending invites may not have partnerId yet — any authenticated non-owner
    // with the invite code may decline; if partnerId is set, must match.
    if (link.partnerId && link.partnerId !== userId) {
      throw makeError('Not allowed to decline this invitation.', 'FORBIDDEN', 403);
    }
    if (!link.partnerId && !inviteCode) {
      throw makeError(
        'Invite code is required to decline an open invitation.',
        'INVITE_CODE_REQUIRED',
        400,
      );
    }

    const updatedAt = nowIso();
    const updated = await store.update(link.id, {
      status: 'revoked',
      partnerId: link.partnerId || userId,
      revokedAt: updatedAt,
      revokedBy: userId,
      updatedAt,
      inviteCodeHash: hashInviteCode(`declined:${link.id}:${updatedAt}`),
    });

    return sanitizeLinkForClient(updated);
  }

  async function revokeLink({ userId, linkId } = {}) {
    if (!userId) {
      throw makeError('Authentication required.', 'AUTH_REQUIRED', 401);
    }
    if (!linkId) {
      throw makeError('Link id is required.', 'LINK_ID_REQUIRED', 400);
    }

    const link = await store.get(linkId);
    if (!link) {
      throw makeError('Link not found.', 'LINK_NOT_FOUND', 404);
    }

    const isOwner = link.ownerId === userId;
    const isPartner = link.partnerId === userId;
    if (!isOwner && !isPartner) {
      throw makeError('Not a participant on this link.', 'FORBIDDEN', 403);
    }
    if (link.status === 'revoked') {
      return sanitizeLinkForClient(link);
    }

    const updatedAt = nowIso();
    const updated = await store.update(link.id, {
      status: 'revoked',
      revokedAt: updatedAt,
      revokedBy: userId,
      updatedAt,
      inviteCodeHash: hashInviteCode(`revoked:${link.id}:${updatedAt}`),
    });

    return sanitizeLinkForClient(updated);
  }

  async function updatePermissions({ userId, linkId, permissions } = {}) {
    if (!userId) {
      throw makeError('Authentication required.', 'AUTH_REQUIRED', 401);
    }
    if (!linkId) {
      throw makeError('Link id is required.', 'LINK_ID_REQUIRED', 400);
    }

    const link = await store.get(linkId);
    if (!link) {
      throw makeError('Link not found.', 'LINK_NOT_FOUND', 404);
    }
    if (link.ownerId !== userId) {
      throw makeError(
        'Only the owner can change permissions.',
        'PERMISSIONS_OWNER_ONLY',
        403,
      );
    }
    if (link.status === 'revoked') {
      throw makeError(
        'Cannot change permissions on a revoked link.',
        'LINK_REVOKED',
        410,
      );
    }

    const nextPermissions = mergePartnerPermissionUpdates(
      link.permissions,
      permissions,
    );
    const updatedAt = nowIso();
    const updated = await store.update(link.id, {
      permissions: nextPermissions,
      updatedAt,
    });

    return sanitizeLinkForClient(updated);
  }

  async function listLinksForUser(userId) {
    if (!userId) {
      throw makeError('Authentication required.', 'AUTH_REQUIRED', 401);
    }
    const links = await store.listForUser(userId);
    return links.map(sanitizeLinkForClient);
  }

  /**
   * Authorize the partner on an active link for the curated view.
   * Owners manage sharing via Profile — they cannot fetch the partner DTO.
   * Returns the raw link for server-side permission reads.
   */
  async function authorizePartnerViewAccess({ userId, linkId } = {}) {
    if (!userId) {
      throw makeError('Authentication required.', 'AUTH_REQUIRED', 401);
    }
    if (!linkId) {
      throw makeError('Link id is required.', 'LINK_ID_REQUIRED', 400);
    }

    const link = await store.get(linkId);
    if (!link) {
      throw makeError('Link not found.', 'LINK_NOT_FOUND', 404);
    }
    if (link.status === 'pending') {
      throw makeError(
        'Pending invitations cannot access shared clinical data.',
        'CLINICAL_ACCESS_PENDING',
        403,
      );
    }
    if (link.status === 'revoked') {
      throw makeError(
        'This partnership has been revoked.',
        'CLINICAL_ACCESS_REVOKED',
        403,
      );
    }
    if (link.status !== 'active') {
      throw makeError('Link is not active.', 'CLINICAL_ACCESS_DENIED', 403);
    }

    const isOwner = link.ownerId === userId;
    const isPartner = link.partnerId === userId;
    if (!isOwner && !isPartner) {
      throw makeError(
        'Not a participant on this link.',
        'CLINICAL_ACCESS_DENIED',
        403,
      );
    }
    if (isOwner) {
      throw makeError(
        'The curated partner view is only available to the linked partner.',
        'CLINICAL_ACCESS_PARTNER_ONLY',
        403,
      );
    }

    return {
      link,
      role: 'partner',
      permissions: publicPermissions(link.permissions),
    };
  }

  /** @deprecated alias — prefer authorizePartnerViewAccess */
  async function assertPartnerClinicalAccess(args) {
    return authorizePartnerViewAccess(args);
  }

  async function revokeAllLinksForUser(userId) {
    if (!userId) return { revoked: 0 };
    const related = await store.listRelatedToUser(userId);
    let revoked = 0;
    const updatedAt = nowIso();
    for (const link of related) {
      if (link.status === 'revoked') continue;
      await store.update(link.id, {
        status: 'revoked',
        revokedAt: updatedAt,
        revokedBy: userId,
        updatedAt,
        inviteCodeHash: hashInviteCode(`account_delete:${link.id}:${updatedAt}`),
      });
      revoked += 1;
    }
    return { revoked };
  }

  return {
    createInvitation,
    acceptInvitation,
    declineInvitation,
    revokeLink,
    updatePermissions,
    listLinksForUser,
    authorizePartnerViewAccess,
    assertPartnerClinicalAccess,
    revokeAllLinksForUser,
    store,
  };
}
