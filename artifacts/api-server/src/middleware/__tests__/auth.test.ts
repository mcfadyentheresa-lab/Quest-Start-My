import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

// Owner-mode is determined at module load by reading process.env.CLERK_SECRET_KEY,
// so we have to manage env state across imports.

describe("requireAuth — owner mode (no CLERK_SECRET_KEY)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.CLERK_SECRET_KEY;
    process.env.OWNER_USER_ID = "owner";
    process.env.OWNER_EMAIL = "owner@example.com";
    // Avoid touching the real DB on import — db lib reads DATABASE_URL eagerly.
    process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("attaches OWNER_USER_ID to req and calls next() with no error", async () => {
    const { requireAuth } = await import("../auth");

    const req: { userId?: string; userEmail?: string; header: () => string | undefined } = {
      header: () => undefined,
    };
    const res = {} as unknown as Parameters<typeof requireAuth>[1];
    const next = vi.fn();

    await requireAuth(
      req as unknown as Parameters<typeof requireAuth>[0],
      res,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe("owner");
    expect(req.userEmail).toBe("owner@example.com");
  });

  it("ignores any Authorization header in owner mode (no token validation)", async () => {
    const { requireAuth } = await import("../auth");

    const req = {
      header: (name: string) => (name.toLowerCase() === "authorization" ? "Bearer junk" : undefined),
    };
    const next = vi.fn();
    await requireAuth(
      req as unknown as Parameters<typeof requireAuth>[0],
      {} as Parameters<typeof requireAuth>[1],
      next,
    );

    expect(next).toHaveBeenCalledWith();
    expect((req as unknown as { userId: string }).userId).toBe("owner");
  });

  it("uses a custom OWNER_USER_ID when set", async () => {
    process.env.OWNER_USER_ID = "user_custom";
    process.env.OWNER_EMAIL = "custom@example.com";
    const { requireAuth } = await import("../auth");

    const req: { userId?: string; userEmail?: string; header: () => undefined } = {
      header: () => undefined,
    };
    const next = vi.fn();
    await requireAuth(
      req as unknown as Parameters<typeof requireAuth>[0],
      {} as Parameters<typeof requireAuth>[1],
      next,
    );
    expect(req.userId).toBe("user_custom");
    expect(req.userEmail).toBe("custom@example.com");
  });

  it("isClerkMode() reports false in owner mode", async () => {
    const { isClerkMode, getOwnerUserId } = await import("../auth");
    expect(isClerkMode()).toBe(false);
    expect(getOwnerUserId()).toBe("owner");
  });
});

describe("requireAuth — Clerk mode (CLERK_SECRET_KEY set)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("rejects requests with no Authorization header as 401", async () => {
    const { requireAuth } = await import("../auth");

    const req = { header: () => undefined };
    const next = vi.fn();
    await requireAuth(
      req as unknown as Parameters<typeof requireAuth>[0],
      {} as Parameters<typeof requireAuth>[1],
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    const passed = next.mock.calls[0]?.[0] as { status?: number; code?: string } | undefined;
    expect(passed?.status).toBe(401);
    expect(passed?.code).toBe("UNAUTHORIZED");
  });

  it("rejects requests with non-Bearer Authorization header", async () => {
    const { requireAuth } = await import("../auth");
    const req = {
      header: (name: string) => (name.toLowerCase() === "authorization" ? "Basic abc" : undefined),
    };
    const next = vi.fn();
    await requireAuth(
      req as unknown as Parameters<typeof requireAuth>[0],
      {} as Parameters<typeof requireAuth>[1],
      next,
    );
    const passed = next.mock.calls[0]?.[0] as { status?: number } | undefined;
    expect(passed?.status).toBe(401);
  });

  it("isClerkMode() reports true when secret key is present", async () => {
    const { isClerkMode } = await import("../auth");
    expect(isClerkMode()).toBe(true);
  });
});
