import { describe, expect, it } from "vitest";
import { ApiError } from "../errors";

describe("ApiError factory methods", () => {
  it("badRequest produces a 400 with BAD_REQUEST code", () => {
    const err = ApiError.badRequest("nope");
    expect(err.status).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("nope");
  });

  it("unauthorized produces a 401 with UNAUTHORIZED code", () => {
    const err = ApiError.unauthorized();
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("forbidden produces a 403 with FORBIDDEN code", () => {
    const err = ApiError.forbidden();
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("notFound produces a 404 with NOT_FOUND code", () => {
    const err = ApiError.notFound();
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("conflict produces a 409 with CONFLICT code", () => {
    const err = ApiError.conflict();
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("unprocessable produces a 422 with UNPROCESSABLE_ENTITY code", () => {
    const err = ApiError.unprocessable();
    expect(err.status).toBe(422);
    expect(err.code).toBe("UNPROCESSABLE_ENTITY");
  });
});

describe("ApiError envelope", () => {
  it("returns the {error: {code, message}} shape", () => {
    const err = ApiError.badRequest("bad");
    expect(err.toEnvelope()).toEqual({
      error: { code: "BAD_REQUEST", message: "bad" },
    });
  });

  it("includes details when provided", () => {
    const err = ApiError.unprocessable("bad input", { field: "email" });
    expect(err.toEnvelope()).toEqual({
      error: {
        code: "UNPROCESSABLE_ENTITY",
        message: "bad input",
        details: { field: "email" },
      },
    });
  });

  it("omits details when not provided", () => {
    const err = ApiError.notFound();
    const envelope = err.toEnvelope();
    expect(envelope.error).not.toHaveProperty("details");
  });
});
