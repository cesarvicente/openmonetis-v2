import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type {
  TransactionImportPreview,
  TransactionImportResult,
} from "@openmonetis/validators/transactions";
import ExcelJS from "exceljs";
import { createTestApiClient } from "./test-support/api-client";
import { withIntegrationDatabase } from "./test-support/integration-database";

const ofx = `OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>Test Bank</ORG><FID>123</FID></FI></SONRS></SIGNONMSGSRSV1><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>123</BANKID><ACCTID>456</ACCTID></BANKACCTFROM><BANKTRANLIST><DTSTART>20200101000000</DTSTART><DTEND>20200131000000</DTEND><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20200110120000[-3:BRT]</DTPOSTED><TRNAMT>-10.01</TRNAMT><FITID>purchase-1</FITID><MEMO>Mercado &amp; Cia</MEMO></STMTTRN><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20200111</DTPOSTED><TRNAMT>100.35</TRNAMT><FITID>income-1</FITID><MEMO>Income</MEMO></STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

test("OFX and spreadsheet imports persist reviewed data, deduplicate and undo owned batches", {
  skip: process.env.IMPORTS_INTEGRATION_TEST !== "1",
}, async (t) => {
  await withIntegrationDatabase(async () => {
    const api = await createTestApiClient();
    const owner = await api.register();
    const stranger = await api.register();
    const { db, transactions } = await import("@openmonetis/db");
    const { eq } = await import("drizzle-orm");
    async function apiResponse() {
      return api.request("/transactions/imports/preview", owner, "POST", {
        fileName: "statement.ofx",
        contentBase64: Buffer.from(ofx).toString("base64"),
      });
    }
    async function readPreview() {
      return api.data<TransactionImportPreview>(await apiResponse());
    }
    const account = await api.account(owner);
    const foreign = await api.account(stranger);
    const parsed = await readPreview();
    const input = {
      sourceFingerprint: parsed.sourceFingerprint,
      destinationType: "account",
      destinationId: account.id,
      paymentMethod: "pix",
      rows: parsed.transactions.map((row) => ({
        externalId: row.externalId,
        name: row.name,
        amount: row.amount,
        type: row.type,
        purchaseDate: row.purchaseDate,
        personId: owner.personId,
        categoryId: row.type === "expense" ? owner.expenseCategoryId : owner.incomeCategoryId,
      })),
    };
    await t.test(
      "OFX preview preserves identifiers, signed transaction types, decoded text and calendar dates",
      async () => {
        assert.equal(parsed.sourceName, "Test Bank");
        assert.equal(parsed.accountNumber, "456");
        assert.deepEqual(
          parsed.transactions.map((row) => [
            row.externalId,
            row.type,
            row.amount,
            row.purchaseDate,
          ]),
          [
            ["purchase-1", "expense", 10.01, "2020-01-10"],
            ["income-1", "income", 100.35, "2020-01-11"],
          ],
        );
        assert.equal(parsed.transactions[0].name, "Mercado & Cia");
        assert.ok(parsed.transactions.every((row) => !row.isDuplicate));
      },
    );
    await t.test(
      "real Excel bytes support Brazilian amounts, Date cells and valid rows beside invalid rows",
      async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Extrato");
        sheet.addRow(["Data", "Descrição", "Valor", "Tipo", "Categoria"]);
        sheet.addRow([
          new Date("2020-01-10T00:00:00Z"),
          "Compra",
          "-1.234,56",
          "despesa",
          "Mercado",
        ]);
        sheet.addRow(["11/01/2020", "Receita", "100,35", "receita", "Salário"]);
        sheet.addRow(["invalid", "Broken", 10, "despesa", ""]);
        const output = await api.data<TransactionImportPreview>(
          await api.request("/transactions/imports/preview", owner, "POST", {
            fileName: "statement.xlsx",
            contentBase64: Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64"),
          }),
        );
        assert.deepEqual(
          output.transactions.map((row) => [row.purchaseDate, row.type, row.amount]),
          [
            ["2020-01-10", "expense", 1234.56],
            ["2020-01-11", "income", 100.35],
          ],
        );
      },
    );
    await t.test(
      "repeated and concurrent imports deduplicate per user and update the preview",
      async () => {
        const responses = await Promise.all([
          api.request("/transactions/imports", owner, "POST", input),
          api.request("/transactions/imports", owner, "POST", input),
        ]);
        const results = await Promise.all(
          responses.map((response) => api.data<TransactionImportResult>(response, 201)),
        );
        assert.equal(
          results.reduce((total, row) => total + row.imported, 0),
          2,
        );
        assert.equal(
          results.reduce((total, row) => total + row.skipped, 0),
          2,
        );
        assert.ok((await readPreview()).transactions.every((row) => row.isDuplicate));
        const rows = await db
          .select()
          .from(transactions)
          .where(eq(transactions.accountId, account.id));
        assert.deepEqual(rows.map((row) => row.amount).sort(), ["-10.01", "100.35"]);
        const other = {
          ...input,
          destinationId: foreign.id,
          rows: input.rows.map((row) => ({
            ...row,
            personId: stranger.personId,
            categoryId:
              row.type === "expense" ? stranger.expenseCategoryId : stranger.incomeCategoryId,
          })),
        };
        assert.equal(
          (
            await api.data<TransactionImportResult>(
              await api.request("/transactions/imports", stranger, "POST", other),
              201,
            )
          ).imported,
          2,
        );
      },
    );
    await t.test(
      "foreign destination, person and category reject the whole batch before writing",
      async () => {
        const before = await db.select().from(transactions);
        for (const patch of [
          { destinationId: foreign.id },
          { rows: [{ ...input.rows[0], externalId: randomUUID(), personId: stranger.personId }] },
          {
            rows: [
              {
                ...input.rows[0],
                externalId: randomUUID(),
                categoryId: stranger.expenseCategoryId,
              },
            ],
          },
        ])
          await api.error(
            await api.request("/transactions/imports", owner, "POST", { ...input, ...patch }),
            404,
          );
        assert.deepEqual(await db.select().from(transactions), before);
      },
    );
    await t.test(
      "undo cannot remove a foreign batch and removes only the requested owned batch",
      async () => {
        const result = await api.data<TransactionImportResult>(
          await api.request("/transactions/imports", owner, "POST", {
            ...input,
            rows: input.rows.map((row) => ({ ...row, externalId: randomUUID() })),
          }),
          201,
        );
        await api.error(
          await api.request(`/transactions/imports/${result.batchId}`, stranger, "DELETE"),
          404,
          "IMPORT_BATCH_NOT_FOUND",
        );
        assert.equal(
          (
            await db
              .select()
              .from(transactions)
              .where(eq(transactions.importBatchId, result.batchId))
          ).length,
          2,
        );
        const undo = await api.data<{ deleted: number }>(
          await api.request(`/transactions/imports/${result.batchId}`, owner, "DELETE"),
        );
        assert.equal(undo.deleted, 2);
        assert.equal(
          (await db.select().from(transactions).where(eq(transactions.accountId, account.id)))
            .length,
          2,
        );
        assert.equal(
          (await db.select().from(transactions).where(eq(transactions.accountId, foreign.id)))
            .length,
          2,
        );
      },
    );
    await t.test(
      "unsupported, corrupt and empty files return controlled errors without writes",
      async () => {
        const before = await db.select().from(transactions);
        for (const fileName of ["statement.exe", "statement.ofx", "statement.xlsx"])
          await api.error(
            await api.request("/transactions/imports/preview", owner, "POST", {
              fileName,
              contentBase64: Buffer.from("not a statement").toString("base64"),
            }),
            400,
          );
        await api.error(
          await api.request("/transactions/imports", owner, "POST", { ...input, rows: [] }),
          400,
        );
        assert.deepEqual(await db.select().from(transactions), before);
      },
    );
  });
});
