#!/usr/bin/env tsx

import { pool } from "@openmonetis/db";
import { defaultAutoSettleTime } from "@openmonetis/domain/preferences";
import { accountsRepository } from "../repositories/accounts.repository";
import { attachmentsRepository } from "../repositories/attachments.repository";
import { listAutoSettleUsers } from "../repositories/transactions.repository";
import { createAccountsService } from "../services/accounts.service";
import { createAttachmentsService } from "../services/attachments.service";
import { createDefaultTransactionsService } from "../transactions-service";
import { attachmentStorage } from "../utils/storage";

const lockName = "openmonetis:auto-settle";
const tickIntervalMs = 5 * 60_000;

const transactionsService = createDefaultTransactionsService(
  createAccountsService(accountsRepository),
  createAttachmentsService(attachmentsRepository, attachmentStorage),
);

let stopping = false;

async function runTick(now = new Date()) {
  const client = await pool.connect();
  try {
    const lock = await client.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock(hashtext($1)) as acquired",
      [lockName],
    );
    if (lock.rows[0]?.acquired !== true) return;
    for (const user of await listAutoSettleUsers()) {
      if (stopping) break;
      const result = await transactionsService
        .settleDueAutomatically(user.userId, user.autoSettleTime ?? defaultAutoSettleTime, now)
        .catch((error) => {
          console.error("auto_settle_user_failed", error);
          return { settled: 0, failed: 1 };
        });
      if (result.settled || result.failed)
        console.log(JSON.stringify({ event: "auto_settle_completed", ...result }));
    }
  } finally {
    await client
      .query("select pg_advisory_unlock(hashtext($1))", [lockName])
      .catch(() => undefined);
    client.release();
  }
}

async function main() {
  while (!stopping) {
    await runTick().catch((error) => {
      console.error("auto_settle_worker_failed", error);
    });
    await new Promise((resolve) => setTimeout(resolve, tickIntervalMs));
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopping = true;
  });
}

await main();
await pool.end();
