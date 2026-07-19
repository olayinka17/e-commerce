import type { Request, Response, NextFunction, RequestHandler } from "express";

export const CatchAsync = <
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any,
>(
  fn: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => Promise<any>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
