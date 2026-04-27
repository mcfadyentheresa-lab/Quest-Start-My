import "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userTimezone?: string;
    }
  }
}

export {};
