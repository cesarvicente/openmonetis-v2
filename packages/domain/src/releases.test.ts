import assert from "node:assert/strict";
import test from "node:test";
import { compareSemanticVersions, getReleaseNotificationKey, isSemanticVersion } from "./releases";

test("stable semantic versions compare numerically and reject malformed versions", () => {
  assert.equal(compareSemanticVersions("1.10.0", "1.2.0"), 1);
  assert.equal(compareSemanticVersions("1.2.0", "2.0.0"), -1);
  assert.equal(compareSemanticVersions("1.2.3", "1.2.3"), 0);
  assert.equal(getReleaseNotificationKey("1.2.3"), "release:1.2.3");
  for (const version of ["v1.2.3", "01.2.3", "1.2", "1.2.3-beta", "invalid"]) {
    assert.equal(isSemanticVersion(version), false);
    assert.throws(() => compareSemanticVersions(version, "1.2.3"));
    assert.throws(() => getReleaseNotificationKey(version));
  }
});
