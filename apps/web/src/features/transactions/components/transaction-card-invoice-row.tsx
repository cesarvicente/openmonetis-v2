import type { TransactionCardInvoiceOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ArrowRight, CreditCard, ReceiptText } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { TableCell, TableRow } from "@/components/ui/table";
import { DueDateIndicator } from "@/features/due-date-rules/components/due-date-indicator";
import { invoicesQueryOptions } from "@/features/invoices/invoices.queries";
import { cn } from "@/lib/utils";
import { formatCardInvoiceEntryCount, formatCompactDate } from "../transactions.presentation";

const logoSizeClassNames = { 32: "size-8", 40: "size-10" } as const;

function CardInvoiceLogo({
  invoice,
  size,
}: {
  invoice: TransactionCardInvoiceOutput;
  size: keyof typeof logoSizeClassNames;
}) {
  return invoice.cardLogo ? (
    <Image
      alt=""
      className={cn("shrink-0 rounded-full object-contain", logoSizeClassNames[size])}
      height={size}
      layout="fixed"
      src={invoice.cardLogo}
      width={size}
    />
  ) : (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-muted text-muted-foreground",
        logoSizeClassNames[size],
      )}
    >
      <CreditCard aria-hidden="true" className="size-4" />
    </span>
  );
}

/** Shows the invoice due date resolved by the API, as transaction rows show their own. */
function CardInvoiceDueDate({
  invoice,
  separator = false,
}: {
  invoice: TransactionCardInvoiceOutput;
  separator?: boolean;
}) {
  const invoicesQuery = useQuery(invoicesQueryOptions(invoice.period));
  const resolved = invoicesQuery.data?.items.find((item) => item.cardId === invoice.cardId);
  const dueDate = resolved?.dueDate ?? invoice.dueDate;

  return dueDate ? (
    <span className="text-brand-strong">
      {separator ? " · " : null}
      <DueDateIndicator
        adjustment={resolved?.dueDateAdjustment}
        dueDate={dueDate}
        editable={resolved?.dueDateExceptionEditable}
        excluded={resolved?.dueDateRuleExcluded}
        originalDueDate={resolved?.originalDueDate}
        target={{ target: "invoice", cardId: invoice.cardId, period: invoice.period }}
      >
        Venc. {formatCompactDate(dueDate)}
      </DueDateIndicator>
    </span>
  ) : null;
}

function cardInvoiceName(invoice: TransactionCardInvoiceOutput) {
  return `Fatura ${invoice.cardName ?? "do cartão"}`;
}

export function TransactionCardInvoiceRow({ invoice }: { invoice: TransactionCardInvoiceOutput }) {
  const name = cardInvoiceName(invoice);

  return (
    <TableRow>
      <TableCell />
      <TableCell className="w-full max-w-0">
        <div className="flex min-w-64 items-center gap-2.5">
          <CardInvoiceLogo invoice={invoice} size={32} />
          <span className="flex min-w-0 flex-col gap-1">
            <Link
              className="min-w-0 truncate rounded-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              params={{ cardId: invoice.cardId }}
              search={{ period: invoice.period }}
              to="/cards/$cardId"
            >
              {name}
            </Link>
            <span className="h-4 whitespace-nowrap text-muted-foreground text-xs">
              {formatCardInvoiceEntryCount(invoice.transactionCount)}
              <CardInvoiceDueDate invoice={invoice} separator />
            </span>
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <span className="sr-only">{invoice.amount > 0 ? "Crédito:" : "Despesa:"}</span>
        <MoneyValue
          amount={invoice.amount}
          className={cn("font-medium", invoice.amount > 0 ? "text-success" : "text-foreground")}
          showPositiveSign={invoice.amount > 0}
        />
      </TableCell>
      <TableCell className="pl-5 whitespace-nowrap">
        <span className="inline-flex items-center gap-2">
          <ReceiptText aria-hidden="true" className="size-4" />
          Fatura
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="inline-flex items-center gap-2">
          <CreditCard aria-hidden="true" className="size-4" />
          Cartão de crédito
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">{invoice.cardName ?? "Cartão"}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end">
          <Link
            aria-label={`Abrir ${name.toLocaleLowerCase("pt-BR")}`}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            params={{ cardId: invoice.cardId }}
            search={{ period: invoice.period }}
            to="/cards/$cardId"
          >
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function MobileTransactionCardInvoiceRow({
  invoice,
}: {
  invoice: TransactionCardInvoiceOutput;
}) {
  const name = cardInvoiceName(invoice);

  return (
    <li className="min-h-20 px-3 py-3">
      <Link
        aria-label={`Abrir ${name.toLocaleLowerCase("pt-BR")}`}
        className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        params={{ cardId: invoice.cardId }}
        search={{ period: invoice.period }}
        to="/cards/$cardId"
      >
        <CardInvoiceLogo invoice={invoice} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-sm">{name}</span>
          <span className="mt-1 block truncate text-muted-foreground text-xs">
            {formatCardInvoiceEntryCount(invoice.transactionCount)}
          </span>
        </span>
        <MoneyValue
          amount={invoice.amount}
          className={cn("shrink-0 font-medium text-sm", invoice.amount > 0 && "text-success")}
          showPositiveSign={invoice.amount > 0}
        />
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      <div className="mt-1 ml-13 text-xs">
        <CardInvoiceDueDate invoice={invoice} />
      </div>
    </li>
  );
}
