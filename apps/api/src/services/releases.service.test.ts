import assert from "node:assert/strict";
import test from "node:test";
import {
  createReleasesService,
  type PublishedRelease,
  type ReleaseCatalogEntry,
  type ReleasesRepository,
} from "./releases.service";

function fixture() {
  const catalog: ReleaseCatalogEntry[] = ["1.2.0", "1.10.0", "1.1.0"].map((version) => ({
    version,
    date: "2026-10-01",
    summary: version,
    sections: [],
  }));
  catalog[0].upgradeNotes = ["Review configuration"];
  let latest: PublishedRelease | null = { version: "1.10.0", url: "https://example.test/v1.10.0" };
  const seen = new Set<string>();
  const writes: unknown[][] = [];
  const repository: ReleasesRepository = {
    currentVersion: "1.2.0",
    releasesUrl: "https://example.test/releases",
    listCatalog: async () => catalog,
    findLatestPublished: async () => latest,
    hasSeen: async (user, version) => seen.has(`${user}:${version}`),
    markSeen: async (user, version, at) => {
      writes.push([user, version, at]);
      seen.add(`${user}:${version}`);
    },
  };
  return {
    catalog,
    writes,
    repository,
    service: createReleasesService(repository, { now: () => new Date("2026-10-20T12:00:00Z") }),
    setLatest(value: PublishedRelease | null) {
      latest = value;
    },
  };
}

test("releases sort numerically, preserve upgrade notes and isolate seen state", async () => {
  const f = fixture();
  const before = structuredClone(f.catalog);
  const result = await f.service.list("owner");
  assert.deepEqual(
    result.releases.map((r) => r.version),
    ["1.10.0", "1.2.0", "1.1.0"],
  );
  assert.equal(result.updateAvailable, true);
  assert.equal(result.hasUnseenCurrentRelease, true);
  assert.deepEqual(result.releases.find((r) => r.isCurrent)?.upgradeNotes, [
    "Review configuration",
  ]);
  assert.deepEqual(result.releases[0].upgradeNotes, []);
  await f.service.markSeen("1.2.0", { seen: true }, "owner");
  assert.equal((await f.service.list("owner")).hasUnseenCurrentRelease, false);
  assert.equal((await f.service.list("stranger")).hasUnseenCurrentRelease, true);
  assert.deepEqual(f.writes, [["owner", "1.2.0", "2026-10-20T12:00:00.000Z"]]);
  assert.deepEqual(f.catalog, before);
});

for (const version of [null, "1.1.0", "1.2.0"])
  test(`release availability handles published version ${version}`, async () => {
    const f = fixture();
    f.setLatest(version ? { version, url: "https://example.test/release" } : null);
    const output = await f.service.list("owner");
    assert.equal(output.updateAvailable, false);
    assert.equal(output.latestVersion, version);
    if (!version) assert.equal(output.latestReleaseUrl, null);
  });

for (const invalid of ["state", "version", "missing"] as const)
  test(`marking releases rejects ${invalid} without writing`, async () => {
    const f = fixture();
    if (invalid === "missing") f.catalog.splice(0);
    await assert.rejects(
      f.service.markSeen(
        invalid === "version" ? "1.1.0" : "1.2.0",
        { seen: invalid !== "state" } as Parameters<typeof f.service.markSeen>[1],
        "owner",
      ),
      {
        code:
          invalid === "state"
            ? "invalid_release_state"
            : invalid === "version"
              ? "release_is_not_current"
              : "release_not_found",
      },
    );
    assert.deepEqual(f.writes, []);
  });

test("release listing fails explicitly when the current catalog entry is missing", async () => {
  const f = fixture();
  f.catalog.splice(0);
  await assert.rejects(f.service.list("owner"), /missing from CHANGELOG/);
});

for (const method of ["listCatalog", "findLatestPublished", "hasSeen", "markSeen"] as const)
  test(`release ${method} propagates repository failure`, async () => {
    const f = fixture();
    const error = new Error("Database unavailable");
    f.repository[method] = async () => {
      throw error;
    };
    await assert.rejects(
      method === "markSeen"
        ? f.service.markSeen("1.2.0", { seen: true }, "owner")
        : f.service.list("owner"),
      (actual) => actual === error,
    );
  });
