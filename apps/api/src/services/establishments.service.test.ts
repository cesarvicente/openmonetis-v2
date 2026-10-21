import assert from "node:assert/strict";
import test from "node:test";
import {
  createEstablishmentsService,
  type EstablishmentLogosGateway,
  type EstablishmentsRepository,
} from "./establishments.service";

function fixture() {
  const entries = new Map<string, string>();
  const writes: unknown[][] = [];
  const repository: EstablishmentsRepository = {
    async findLogoDomain(user, key) {
      return entries.get(`${user}:${key}`) ?? null;
    },
    async saveLogoDomain(user, key, domain) {
      writes.push([user, key, domain]);
      entries.set(`${user}:${key}`, domain);
    },
    async removeLogoDomain(user, key) {
      writes.push([user, key]);
      entries.delete(`${user}:${key}`);
    },
  };
  const gateway: EstablishmentLogosGateway = {
    enabled: true,
    buildLogoUrl: (domain) => (domain ? `https://images.example.test/${domain}` : null),
    search: async () => [],
  };
  return {
    entries,
    writes,
    repository,
    gateway,
    service: createEstablishmentsService(repository, gateway),
  };
}

test("merchant logo normalization is scoped per user and removal preserves other users", async () => {
  const f = fixture();
  await f.service.setLogo(
    { name: " Café   São Paulo! ", domain: "HTTPS://SHOP.EXAMPLE.COM/logos/a" },
    "owner",
  );
  await f.service.setLogo({ name: "Café São Paulo!", domain: "other.example.com" }, "stranger");
  assert.deepEqual(await f.service.getLogo("cafe sao paulo", "owner"), {
    nameKey: "cafe-sao-paulo",
    domain: "shop.example.com",
    logoUrl: "https://images.example.test/shop.example.com",
    enabled: true,
  });
  assert.deepEqual(await f.service.removeLogo("Café São Paulo!", "owner"), {
    nameKey: "cafe-sao-paulo",
    domain: null,
    logoUrl: null,
    enabled: true,
  });
  assert.equal(
    (await f.service.getLogo("Café São Paulo!", "stranger")).domain,
    "other.example.com",
  );
  assert.equal((await f.service.getLogo("Unknown", "owner")).logoUrl, null);
});

test("logo search passes the query to the gateway and returns its results", async () => {
  const f = fixture();
  let query = "";
  f.gateway.search = async (value) => {
    query = value;
    return [
      {
        name: "Shop",
        domain: "shop.example.com",
        logoUrl: "https://images.example.test/shop.example.com",
      },
    ];
  };
  const result = await f.service.searchLogos("shop");
  assert.equal(query, "shop");
  assert.equal(result[0].domain, "shop.example.com");
});

for (const failure of ["disabled", "network"] as const)
  test(`logo search handles ${failure} without exposing provider errors`, async () => {
    const f = fixture();
    let calls = 0;
    f.gateway.enabled = failure !== "disabled";
    f.gateway.search = async () => {
      calls++;
      throw new Error("private provider detail");
    };
    await assert.rejects(f.service.searchLogos("shop"), {
      status: 503,
      code: "logo_dev_unavailable",
      message:
        failure === "disabled" ? "Logo search is not configured" : "Logo search is unavailable",
    });
    assert.equal(calls, failure === "disabled" ? 0 : 1);
    assert.deepEqual(f.writes, []);
  });

for (const operation of ["getLogo", "setLogo", "removeLogo"] as const)
  test(`merchant ${operation} propagates repository failure`, async () => {
    const f = fixture();
    const error = new Error("Database unavailable");
    const fail = async () => {
      throw error;
    };
    f.repository.findLogoDomain = fail;
    f.repository.saveLogoDomain = fail;
    f.repository.removeLogoDomain = fail;
    await assert.rejects(
      operation === "setLogo"
        ? f.service.setLogo({ name: "Shop", domain: "shop.test" }, "owner")
        : f.service[operation]("Shop", "owner"),
      (actual) => actual === error,
    );
  });
