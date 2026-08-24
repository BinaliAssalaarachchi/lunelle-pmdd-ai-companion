import { Router } from 'express';
import {
  getFirestore,
  isFirebaseAdminConfigured,
} from '../lib/firebase-admin.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createPartnerAcceptRateLimiter,
  partnerAcceptRateLimitPreCheck,
  shouldCountPartnerAcceptFailure,
} from '../middleware/partnerAcceptRateLimit.js';
import {
  createFirestorePartnerLinkStore,
  createPartnerLifecycleService,
} from '../services/partnerLifecycle.js';
import {
  buildPartnerViewDto,
  createFirestorePartnerOwnerData,
} from '../services/partnerView.js';

const router = Router();

let lifecycleService = null;
let ownerDataSource = null;
let acceptRateLimiter = createPartnerAcceptRateLimiter();

export function setPartnerLifecycleServiceForTests(service) {
  lifecycleService = service;
}

export function setPartnerOwnerDataForTests(dataSource) {
  ownerDataSource = dataSource;
}

export function setPartnerAcceptRateLimiterForTests(limiter) {
  acceptRateLimiter = limiter;
}

export function getPartnerAcceptRateLimiter() {
  return acceptRateLimiter;
}

function getLifecycle() {
  if (lifecycleService) return lifecycleService;
  if (!isFirebaseAdminConfigured()) {
    const error = new Error(
      'Firebase Admin is not configured for partner sharing.',
    );
    error.status = 503;
    error.code = 'FIREBASE_ADMIN_MISSING';
    throw error;
  }
  lifecycleService = createPartnerLifecycleService(
    createFirestorePartnerLinkStore(getFirestore()),
  );
  return lifecycleService;
}

function getOwnerData() {
  if (ownerDataSource) return ownerDataSource;
  if (!isFirebaseAdminConfigured()) {
    const error = new Error(
      'Firebase Admin is not configured for partner sharing.',
    );
    error.status = 503;
    error.code = 'FIREBASE_ADMIN_MISSING';
    throw error;
  }
  ownerDataSource = createFirestorePartnerOwnerData(getFirestore());
  return ownerDataSource;
}

function sendServiceError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({
    error: error.message || 'Partner request failed',
    code: error.code || 'PARTNER_ERROR',
  });
}

/** Owner creates a pending invitation. Returns inviteCode once. */
router.post('/invite', requireAuth, async (req, res) => {
  try {
    const result = await getLifecycle().createInvitation({
      ownerId: req.userId,
      partnerEmail: req.body?.partnerEmail ?? null,
    });
    return res.status(201).json({
      link: result.link,
      inviteCode: result.inviteCode,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

/** Partner accepts a pending invite by code. */
router.post(
  '/accept',
  requireAuth,
  partnerAcceptRateLimitPreCheck(() => acceptRateLimiter),
  async (req, res) => {
    try {
      const link = await getLifecycle().acceptInvitation({
        userId: req.userId,
        inviteCode: req.body?.inviteCode,
      });
      acceptRateLimiter.recordSuccess(req.userId);
      return res.json({ link });
    } catch (error) {
      if (shouldCountPartnerAcceptFailure(error)) {
        acceptRateLimiter.recordFailure(req.userId);
      }
      return sendServiceError(res, error);
    }
  },
);

/** Partner declines a pending invite. */
router.post('/decline', requireAuth, async (req, res) => {
  try {
    const link = await getLifecycle().declineInvitation({
      userId: req.userId,
      inviteCode: req.body?.inviteCode,
      linkId: req.body?.linkId,
    });
    return res.json({ link });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

/** Owner or partner revokes a link. */
router.post('/revoke', requireAuth, async (req, res) => {
  try {
    const link = await getLifecycle().revokeLink({
      userId: req.userId,
      linkId: req.body?.linkId,
    });
    return res.json({ link });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

/** Owner updates permissions (default-deny merge). */
router.patch('/links/:linkId/permissions', requireAuth, async (req, res) => {
  try {
    const link = await getLifecycle().updatePermissions({
      userId: req.userId,
      linkId: req.params.linkId,
      permissions: req.body?.permissions,
    });
    return res.json({ link });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

/** Metadata-only list for the signed-in user. */
router.get('/links', requireAuth, async (req, res) => {
  try {
    const links = await getLifecycle().listLinksForUser(req.userId);
    return res.json({ links });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

/**
 * Curated partner view (Phase 3).
 * Ignores client-supplied permissions, ownerId, partnerId, and field lists.
 * linkId is only used to locate the relationship; access is derived from auth + link.
 */
router.get('/view', requireAuth, async (req, res) => {
  try {
    const linkId = String(req.query.linkId || '').trim();
    const authz = await getLifecycle().authorizePartnerViewAccess({
      userId: req.userId,
      linkId,
    });

    const dto = await buildPartnerViewDto({
      link: authz.link,
      requesterId: req.userId,
      ownerData: getOwnerData(),
    });

    return res.json(dto);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export default router;
