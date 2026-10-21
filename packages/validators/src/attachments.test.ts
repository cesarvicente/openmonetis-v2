import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { maximumAttachmentSize, PrepareAttachmentInputSchema } from "./attachments";

test("upload contracts reject oversized files, fractional sizes, unsupported MIME and invalid transaction IDs", () => {
  const input = {
    transactionId: randomUUID(),
    fileName: "receipt.pdf",
    mimeType: "application/pdf",
    fileSize: maximumAttachmentSize,
  };
  assert.equal(PrepareAttachmentInputSchema.safeParse(input).success, true);
  for (const patch of [
    { fileSize: maximumAttachmentSize + 1 },
    { fileSize: 0 },
    { fileSize: 0.5 },
    { mimeType: "image/svg+xml" },
    { transactionId: "invalid" },
    { fileName: " " },
  ])
    assert.equal(PrepareAttachmentInputSchema.safeParse({ ...input, ...patch }).success, false);
});
