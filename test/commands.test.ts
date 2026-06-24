import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { profileCommand } from "../src/cli/commands/profile.js";
import { linkCommand } from "../src/cli/commands/link.js";
import { renderStorefrontList, storeCommand } from "../src/cli/commands/store.js";
import { productCommand } from "../src/cli/commands/product.js";
import { UsageError } from "../src/cli/commands/registry.js";

function fakeClient() {
  const calls: { name: string; input: unknown }[] = [];
  const rec = (name: string) => async (input: unknown) => { calls.push({ name, input }); return {}; };
  const client: unknown = {
    profile: {
      get: rec("profile.get"),
      update: rec("profile.update"),
      setAvatar: rec("profile.setAvatar"),
      setBanner: rec("profile.setBanner"),
      featureNft: rec("profile.featureNft"),
      updateUsername: rec("profile.updateUsername"),
    },
    links: {
      add: rec("links.add"),
      list: rec("links.list"),
      delete: rec("links.delete"),
      update: rec("links.update"),
      reorder: rec("links.reorder"),
    },
    storefronts: {
      create: rec("storefronts.create"),
      mine: async () => { calls.push({ name: "storefronts.mine", input: undefined }); return []; },
      get: rec("storefronts.get"),
      update: rec("storefronts.update"),
    },
    products: {
      add: rec("products.add"),
      addWithFile: rec("products.addWithFile"),
      mine: async () => { calls.push({ name: "products.mine", input: undefined }); return []; },
      unlist: rec("products.unlist"),
      delete: rec("products.delete"),
      edit: rec("products.edit"),
      browse: rec("products.browse"),
    },
  };
  return { client, calls };
}

const ctx = (client: unknown, positionals: string[], flags: Record<string, unknown> = {}) => ({
  client: client as Parameters<typeof profileCommand>[0]["client"],
  args: { positionals, flags: flags as Record<string, string | boolean> },
  json: true,
  baseUrl: "https://x.test",
});

// ---- profile ----

test("profile set maps flags to update", async () => {
  const { client, calls } = fakeClient();
  await profileCommand(ctx(client, ["profile", "set"], { bio: "hi", "display-name": "Me" }));
  assert.equal(calls[0].name, "profile.update");
  assert.deepEqual(calls[0].input, { bio: "hi", display_name: "Me" });
});

test("profile set with all known flags maps correctly", async () => {
  const { client, calls } = fakeClient();
  await profileCommand(ctx(client, ["profile", "set"], {
    bio: "b", website: "https://w.com", "display-name": "D", twitter: "tw",
    instagram: "ig", telegram: "tg", farcaster: "fc", theme: "dark",
  }));
  assert.equal(calls[0].name, "profile.update");
  assert.deepEqual(calls[0].input, {
    bio: "b", website: "https://w.com", display_name: "D", twitter: "tw",
    instagram: "ig", telegram: "tg", farcaster: "fc", theme: "dark",
  });
});

test("profile set with no flags throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => profileCommand(ctx(client, ["profile", "set"], {})),
    (e: unknown) => e instanceof UsageError,
  );
});

test("profile set-username maps positional handle to updateUsername", async () => {
  const { client, calls } = fakeClient();
  await profileCommand(ctx(client, ["profile", "set-username", "charlescrain"], {}));
  assert.equal(calls[0].name, "profile.updateUsername");
  assert.deepEqual(calls[0].input, { username: "charlescrain" });
});

test("profile set-username accepts --username flag", async () => {
  const { client, calls } = fakeClient();
  await profileCommand(ctx(client, ["profile", "set-username"], { username: "charlescrain" }));
  assert.equal(calls[0].name, "profile.updateUsername");
  assert.deepEqual(calls[0].input, { username: "charlescrain" });
});

test("profile set-username with no handle throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => profileCommand(ctx(client, ["profile", "set-username"], {})),
    (e: unknown) => e instanceof UsageError,
  );
});

test("profile show calls profile.get with slug", async () => {
  const { client, calls } = fakeClient();
  await profileCommand(ctx(client, ["profile", "show"], { slug: "alice" }));
  assert.equal(calls[0].name, "profile.get");
  assert.deepEqual(calls[0].input, { slug: "alice" });
});

test("profile show without slug calls profile.get with undefined slug", async () => {
  const { client, calls } = fakeClient();
  await profileCommand(ctx(client, ["profile", "show"]));
  assert.equal(calls[0].name, "profile.get");
  assert.deepEqual(calls[0].input, { slug: undefined });
});

test("profile feature-nft maps flags correctly", async () => {
  const { client, calls } = fakeClient();
  await profileCommand(ctx(client, ["profile", "feature-nft"], {
    chain: "eth", contract: "0xabc", "token-id": "42", "image-url": "https://img",
  }));
  assert.equal(calls[0].name, "profile.featureNft");
  assert.deepEqual(calls[0].input, { chain: "eth", contract: "0xabc", tokenId: "42", imageUrl: "https://img" });
});

test("profile feature-nft throws UsageError when required flags missing", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => profileCommand(ctx(client, ["profile", "feature-nft"], { chain: "eth" })),
    (e: unknown) => e instanceof UsageError,
  );
});

test("unknown profile subcommand throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => profileCommand(ctx(client, ["profile", "frobnicate"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("profile set-avatar requires path positional", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => profileCommand(ctx(client, ["profile", "set-avatar"])),
    (e: unknown) => e instanceof UsageError,
  );
});

// ---- link ----

test("link add maps positionals to add call", async () => {
  const { client, calls } = fakeClient();
  await linkCommand(ctx(client, ["link", "add", "My Site", "https://example.com"]));
  assert.equal(calls[0].name, "links.add");
  assert.deepEqual(calls[0].input, { title: "My Site", url: "https://example.com", icon: undefined });
});

test("link add with icon flag", async () => {
  const { client, calls } = fakeClient();
  await linkCommand(ctx(client, ["link", "add", "GitHub", "https://github.com"], { icon: "github" }));
  assert.equal(calls[0].name, "links.add");
  assert.deepEqual(calls[0].input, { title: "GitHub", url: "https://github.com", icon: "github" });
});

test("link add without required positionals throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => linkCommand(ctx(client, ["link", "add", "Only Title"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("link list calls links.list", async () => {
  const { client, calls } = fakeClient();
  await linkCommand(ctx(client, ["link", "list"]));
  assert.equal(calls[0].name, "links.list");
  assert.deepEqual(calls[0].input, {});
});

test("link rm calls links.delete with id", async () => {
  const { client, calls } = fakeClient();
  await linkCommand(ctx(client, ["link", "rm", "link-123"]));
  assert.equal(calls[0].name, "links.delete");
  assert.deepEqual(calls[0].input, { linkId: "link-123" });
});

test("link rm without id throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => linkCommand(ctx(client, ["link", "rm"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("link update maps flags correctly", async () => {
  const { client, calls } = fakeClient();
  await linkCommand(ctx(client, ["link", "update", "link-456"], { title: "New Title", url: "https://new.url" }));
  assert.equal(calls[0].name, "links.update");
  assert.deepEqual(calls[0].input, { linkId: "link-456", title: "New Title", url: "https://new.url" });
});

test("link reorder passes ordered ids", async () => {
  const { client, calls } = fakeClient();
  await linkCommand(ctx(client, ["link", "reorder", "id1", "id2", "id3"]));
  assert.equal(calls[0].name, "links.reorder");
  assert.deepEqual(calls[0].input, { linkIds: ["id1", "id2", "id3"] });
});

test("link reorder without ids throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => linkCommand(ctx(client, ["link", "reorder"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("unknown link subcommand throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => linkCommand(ctx(client, ["link", "bogus"])),
    (e: unknown) => e instanceof UsageError,
  );
});

// ---- store ----

test("store create maps name and description", async () => {
  const { client, calls } = fakeClient();
  await storeCommand(ctx(client, ["store", "create", "My Shop"], { description: "A great store" }));
  assert.equal(calls[0].name, "storefronts.create");
  assert.deepEqual(calls[0].input, { name: "My Shop", description: "A great store" });
});

test("store create without name throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => storeCommand(ctx(client, ["store", "create"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("store list calls storefronts.mine", async () => {
  const { client, calls } = fakeClient();
  await storeCommand(ctx(client, ["store", "list"]));
  assert.equal(calls[0].name, "storefronts.mine");
});

test("store list human output renders storefront arrays", () => {
  assert.equal(
    renderStorefrontList([{ id: "sf_1", name: "My Store", slug: "my-store" }]),
    "1 storefront: My Store (/my-store, sf_1)",
  );
});

test("store list human output renders wrapped storefront arrays", () => {
  assert.equal(
    renderStorefrontList({
      data: {
        storefronts: [
          { id: "sf_1", name: "My Store", slug: "my-store" },
          { id: "sf_2", name: "Second Store" },
        ],
      },
    }),
    "2 storefronts: My Store (/my-store, sf_1); Second Store (sf_2)",
  );
});

test("store list human output renders empty recognized lists", () => {
  assert.equal(renderStorefrontList({ storefronts: [] }), "0 storefronts");
});

test("store get calls storefronts.get with slug", async () => {
  const { client, calls } = fakeClient();
  await storeCommand(ctx(client, ["store", "get", "my-store"]));
  assert.equal(calls[0].name, "storefronts.get");
  assert.deepEqual(calls[0].input, { slug: "my-store" });
});

test("store update maps all flags correctly", async () => {
  const { client, calls } = fakeClient();
  await storeCommand(ctx(client, ["store", "update", "store-123"], {
    name: "Renamed", description: "desc", bio: "bio", website: "https://w.com",
    twitter: "tw", telegram: "tg", farcaster: "fc", theme: "dark",
  }));
  assert.equal(calls[0].name, "storefronts.update");
  assert.deepEqual(calls[0].input, {
    storefrontId: "store-123",
    name: "Renamed", description: "desc", bio: "bio", website: "https://w.com",
    twitter: "tw", telegram: "tg", farcaster: "fc", theme: "dark",
  });
});

test("unknown store subcommand throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => storeCommand(ctx(client, ["store", "bogus"])),
    (e: unknown) => e instanceof UsageError,
  );
});

// ---- product ----

test("product add calls products.add when no file flag", async () => {
  const { client, calls } = fakeClient();
  await productCommand(ctx(client, ["product", "add"], {
    store: "store-1", title: "My Product", price: "9.99", description: "Great item",
  }));
  assert.equal(calls[0].name, "products.add");
  assert.deepEqual(calls[0].input, {
    storefrontId: "store-1", title: "My Product", price: "9.99", description: "Great item",
  });
});

test("product add missing required flags throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => productCommand(ctx(client, ["product", "add"], { store: "s1", title: "T" })),
    (e: unknown) => e instanceof UsageError,
  );
});

test("product add with --file reads bytes and calls addWithFile", async () => {
  const { client, calls } = fakeClient();
  const dir = mkdtempSync(join(tmpdir(), "rare-test-"));
  const filePath = join(dir, "avatar.png");
  const content = Buffer.from("fake-image-bytes");
  writeFileSync(filePath, content);
  try {
    await productCommand(ctx(client, ["product", "add"], {
      store: "store-2", title: "Art NFT", price: "1.00", file: filePath,
    }));
    assert.equal(calls[0].name, "products.addWithFile");
    const input = calls[0].input as {
      storefrontId: string; title: string; price: string;
      fileName: string; bytes: Uint8Array; description: undefined;
    };
    assert.equal(input.storefrontId, "store-2");
    assert.equal(input.title, "Art NFT");
    assert.equal(input.price, "1.00");
    assert.equal(input.fileName, "avatar.png");
    assert.ok(input.bytes.length > 0, "bytes should be non-empty");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("product list calls products.mine", async () => {
  const { client, calls } = fakeClient();
  await productCommand(ctx(client, ["product", "list"]));
  assert.equal(calls[0].name, "products.mine");
});

test("product unlist calls products.unlist with id", async () => {
  const { client, calls } = fakeClient();
  await productCommand(ctx(client, ["product", "unlist", "prod-99"]));
  assert.equal(calls[0].name, "products.unlist");
  assert.deepEqual(calls[0].input, { productId: "prod-99" });
});

test("product rm calls products.delete with id", async () => {
  const { client, calls } = fakeClient();
  await productCommand(ctx(client, ["product", "rm", "prod-88"]));
  assert.equal(calls[0].name, "products.delete");
  assert.deepEqual(calls[0].input, { productId: "prod-88" });
});

test("product edit maps flags correctly", async () => {
  const { client, calls } = fakeClient();
  await productCommand(ctx(client, ["product", "edit", "prod-77"], { title: "New Title", price: "5.00" }));
  assert.equal(calls[0].name, "products.edit");
  assert.deepEqual(calls[0].input, { productId: "prod-77", title: "New Title", price: "5.00" });
});

test("product browse maps content-type and listing-type flags", async () => {
  const { client, calls } = fakeClient();
  await productCommand(ctx(client, ["product", "browse"], { "content-type": "audio", "listing-type": "fixed" }));
  assert.equal(calls[0].name, "products.browse");
  assert.deepEqual(calls[0].input, { contentType: "audio", listingType: "fixed" });
});

test("product browse with filter flag", async () => {
  const { client, calls } = fakeClient();
  await productCommand(ctx(client, ["product", "browse"], { filter: "music" }));
  assert.equal(calls[0].name, "products.browse");
  assert.deepEqual(calls[0].input, { filter: "music" });
});

test("unknown product subcommand throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => productCommand(ctx(client, ["product", "bogus"])),
    (e: unknown) => e instanceof UsageError,
  );
});
