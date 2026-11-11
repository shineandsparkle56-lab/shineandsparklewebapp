/**
 * invoiceNumber.ts
 * Sequential GST invoice number generation and assignment.
 *
 * Rules:
 *  - Format: {prefix}{5-digit-sequence}  e.g. shine00084
 *  - Sequence = MAX existing sequence number + 1  (safe even if rows deleted)
 *  - Once assigned to an order, NEVER changes (enforced by UNIQUE INDEX in DB)
 *  - Only assigned when admin explicitly clicks "Bill" — never automatic
 */

import { supabase } from "./supabase";

/**
 * Generate the next sequential invoice number for the given prefix.
 *
 * Uses MAX of existing sequence numbers, NOT COUNT — so it is safe even if
 * old invoice rows are deleted (count would give a duplicate; max won't).
 *
 * Example:
 *   Existing: shine00001 … shine00083  → MAX = 83 → next = shine00084
 *   If shine00040 deleted: MAX still = 83 → next still = shine00084 ✓
 */
export async function generateNextInvoiceNumber(prefix: string): Promise<string> {
  // Fetch all existing invoice numbers with this prefix to find the max sequence
  const { data, error } = await supabase
    .from("orders")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`);

  if (error) throw new Error(`Failed to fetch invoices: ${error.message}`);

  // Parse numeric suffix from each invoice_number and find the maximum
  let maxSeq = 0;
  for (const row of data ?? []) {
    const raw = (row.invoice_number as string ?? "").slice(prefix.length);
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > maxSeq) maxSeq = num;
  }

  const next = maxSeq + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

/**
 * Assign a new sequential invoice number to an order.
 * - If the order already has an invoice_number → returns it unchanged (idempotent)
 * - If not → generates the next number, saves to DB, returns it
 *
 * The UNIQUE INDEX on invoice_number prevents race conditions / duplicates.
 * If two clicks happen simultaneously, one will get a DB unique-constraint error
 * and the caller should retry (assignInvoiceNumber is safe to call again).
 */
export async function assignInvoiceNumber(
  orderId: number,
  prefix: string,
  currentInvoiceNumber?: string | null,
): Promise<string> {
  // Already assigned — never regenerate
  if (currentInvoiceNumber?.trim()) return currentInvoiceNumber.trim();

  const invoiceNo = await generateNextInvoiceNumber(prefix);

  const { error } = await supabase
    .from("orders")
    .update({ invoice_number: invoiceNo })
    .eq("id", orderId);

  if (error) throw new Error(`Failed to save invoice number: ${error.message}`);

  return invoiceNo;
}
