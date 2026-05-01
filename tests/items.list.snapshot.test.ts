import { expect, test } from "vitest";
import { GET } from "@/app/api/[chronicle]/items/route";

/**
 * Locks the `GET /api/[chronicle]/items` list response — the
 * `ItemListDto` field set, the `{data, meta}` envelope, the
 * default sort, and three representative filter/sort combinations.
 *
 * Pagination is held to `limit=5` so the snapshot stays readable
 * (one item per ~7 lines × 5 = ~35 lines per fixture body) and
 * still locks the field shape exhaustively. Larger pages would
 * inflate the snapshot without adding contract value.
 *
 * Calls the actual route handler with a constructed `Request` so
 * the snapshot exercises the same code path the lambda runs:
 * param parsing, query validation, sort/filter, DTO mapping, and
 * the JSON response envelope.
 */
async function call(search: string) {
  const response = await GET(
    new Request(`http://test/api/interlude/items${search}`),
    { params: Promise.resolve({ chronicle: "interlude" }) }
  );
  return { status: response.status, body: await response.json() };
}

test("items list — default sort, limit=5", async () => {
  expect(await call("?limit=5")).toMatchSnapshot();
});

test("items list — page 2 (limit=5&offset=5)", async () => {
  expect(await call("?limit=5&offset=5")).toMatchSnapshot();
});

test("items list — sort=name asc, limit=5", async () => {
  expect(await call("?limit=5&sort=name")).toMatchSnapshot();
});

test("items list — type=weapon&grade=s, limit=5", async () => {
  expect(await call("?limit=5&type=weapon&grade=s")).toMatchSnapshot();
});

test("items list — invalid grade returns 400", async () => {
  expect(await call("?grade=xx")).toMatchSnapshot();
});
