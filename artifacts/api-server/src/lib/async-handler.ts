import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wrap an async Express route handler so any thrown error or rejected
 * promise is forwarded to Express's error-handling middleware. Express 4
 * does NOT auto-catch promise rejections from async handlers — without this
 * wrap, a thrown DB error (e.g. "relation does not exist" after a missed
 * migration) results in a hung request that Express eventually serves a
 * generic 500 for, with no logged context.
 *
 * The generic signature preserves Express's path-parameter type inference
 * (e.g. `req.params.id` stays `string`, not `string | string[]`), so call
 * sites don't lose type safety.
 *
 * Usage:
 *   router.get("/areas", asyncHandler(async (req, res) => {
 *     const areas = await db.select()...;
 *     res.json(areas);
 *   }));
 */
export function asyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string | string[] | undefined>,
>(
  fn: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => Promise<unknown>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
