import assert from "node:assert/strict";
import test from "node:test";
import {
  attachmentMimeTypes,
  hasAllowedAttachmentSignature,
  isAllowedAttachment,
  maximumAttachmentSize,
  normalizeAttachmentFileName,
} from "./attachments";

test("attachment whitelist accepts exact size boundaries and rejects unsupported or fractional sizes", () => {
  for (const mime of attachmentMimeTypes) {
    assert.equal(isAllowedAttachment(mime, 1), true);
    assert.equal(isAllowedAttachment(mime, maximumAttachmentSize), true);
    for (const size of [0, -1, 0.5, maximumAttachmentSize + 1, NaN, Infinity])
      assert.equal(isAllowedAttachment(mime, size), false);
  }
  for (const mime of [
    "text/html",
    "image/svg+xml",
    "application/octet-stream",
    "image/png; charset=utf-8",
  ])
    assert.equal(isAllowedAttachment(mime, 10), false);
});

test("all supported file signatures reject truncated, forged and mismatched content", () => {
  const samples = [
    ["application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]],
    ["image/jpeg", [0xff, 0xd8, 0xff]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
  ] as const;
  for (const [mime, content] of samples) {
    assert.equal(hasAllowedAttachmentSignature(mime, Uint8Array.from(content)), true);
    assert.equal(hasAllowedAttachmentSignature(mime, Uint8Array.from(content.slice(0, -1))), false);
    assert.equal(
      hasAllowedAttachmentSignature(mime, new TextEncoder().encode("<script>alert(1)</script>")),
      false,
    );
    for (const other of attachmentMimeTypes.filter((value) => value !== mime))
      assert.equal(hasAllowedAttachmentSignature(other, Uint8Array.from(content)), false);
  }
});

test("attachment names remove path separators, controls and directional overrides", () => {
  assert.equal(
    normalizeAttachmentFileName("../receipt\\invoice\u0000\u202e.pdf"),
    ".._receipt_invoice .pdf",
  );
  for (const name of ["", " ", ".", "..", "\u0000"])
    assert.equal(normalizeAttachmentFileName(name), "attachment");
  assert.equal(Array.from(normalizeAttachmentFileName("😀".repeat(300))).length, 255);
});
