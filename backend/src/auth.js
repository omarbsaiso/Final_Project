import { ApiError } from './errors.js';

export const PRIVATE_ADMIN_UID = 'mnLf1b3jZLUIqZlgDoAgK9QrMbp1';

export function createAuthenticate(auth, db) {
  return async function authenticate(req, res, next) {
    const authorization = req.get('authorization') || '';
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return next(new ApiError(401, 'AUTH_REQUIRED'));

    try {
      const decoded = await auth.verifyIdToken(token);
      const snapshot = await db.collection('users').doc(decoded.uid).get();
      if (!snapshot.exists || snapshot.data()?.isActive !== true) {
        return next(new ApiError(403, 'PROFILE_INACTIVE'));
      }

      const profile = snapshot.data();
      const role = decoded.uid === PRIVATE_ADMIN_UID && profile.role === 'admin'
        ? 'Admin'
        : profile.role;
      const isAdmin = profile.isActive === true && (
        (role === 'Admin' && profile.isDemo !== true)
        || (decoded.uid === PRIVATE_ADMIN_UID && profile.role === 'admin')
      );
      if (!['Admin', 'Supervisor', 'Agent', 'Demo'].includes(role)) {
        return next(new ApiError(403, 'PROFILE_INACTIVE'));
      }

      req.user = {
        uid: decoded.uid,
        email: decoded.email || profile.email || '',
        fullName: profile.fullName || profile.name || '',
        team: profile.team || '',
        role,
        isDemo: profile.isDemo === true,
        isAdmin,
      };
      return next();
    } catch (error) {
      if (error instanceof ApiError) return next(error);
      return next(new ApiError(401, 'AUTH_INVALID'));
    }
  };
}

export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return next(new ApiError(403, 'ADMIN_REQUIRED'));
  return next();
}

export function canReadCall(user, call) {
  if (!user || !call) return false;
  if (user.isAdmin) return true;
  if (user.role === 'Supervisor' && user.team && call.team === user.team) return true;
  if (user.role === 'Agent' && call.agentId === user.uid) return true;
  return user.role === 'Demo' && user.isDemo && call.isDemo === true;
}
