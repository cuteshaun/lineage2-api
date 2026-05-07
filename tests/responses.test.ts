import { describe, expect, test } from "vitest";

import { GET as itemDetailGET } from "@/app/api/[chronicle]/items/[id]/route";
import {
  ERROR_CACHE_CONTROL,
  SUCCESS_CACHE_CONTROL,
  jsonError,
  jsonList,
  jsonOk,
  parsePagination,
} from "@/lib/api/responses";

/**
 * Locks the v1 cache-control contract on the three response helpers
 * and the pagination clamp. These helpers feed every API route, so
 * a regression here would flip the cache behaviour across the whole
 * surface — covered separately from the snapshot suite, which only
 * locks DTO shape.
 */

describe("response cache headers", () => {
  test("jsonOk uses the success Cache-Control", () => {
    const response = jsonOk({ id: 1 });
    expect(response.headers.get("Cache-Control")).toBe(SUCCESS_CACHE_CONTROL);
  });

  test("jsonList uses the success Cache-Control", () => {
    const response = jsonList([], { total: 0, limit: 50, offset: 0 });
    expect(response.headers.get("Cache-Control")).toBe(SUCCESS_CACHE_CONTROL);
  });

  test("jsonError uses no-store", () => {
    const response = jsonError("nope", 404);
    expect(response.headers.get("Cache-Control")).toBe(ERROR_CACHE_CONTROL);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("parsePagination clamp", () => {
  function parse(query: string) {
    return parsePagination(new URLSearchParams(query));
  }

  test("limit above MAX_LIMIT is clamped to 200", () => {
    const result = parse("limit=10000");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pagination.limit).toBe(200);
      expect(result.pagination.offset).toBe(0);
    }
  });

  test("limit=0 is rejected with 400", async () => {
    const result = parse("limit=0");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  test("offset=-1 is rejected with 400", async () => {
    const result = parse("offset=-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  test("missing params use defaults (50, 0)", () => {
    const result = parse("");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.offset).toBe(0);
    }
  });
});

describe("error responses end-to-end", () => {
  test("unknown item id returns 404 with no-store", async () => {
    const response = await itemDetailGET(
      new Request("http://test/api/interlude/items/999999"),
      {
        params: Promise.resolve({ chronicle: "interlude", id: "999999" }),
      }
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe(ERROR_CACHE_CONTROL);
  });
});
