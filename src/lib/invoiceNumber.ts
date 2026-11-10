/**
 * invoiceNumber.ts
 * Sequential GST invoice number generation and assignment.
 *
 * Rules:
 *  - Format: {prefix}{5-digit-sequence}  e.g. shine00084
 *  - Sequence = count of existing invoice_number rows starting with prefix + 1
 *  - Once assigned to an order, NEVER changes (enforced by UNIQUE INDEX in DB)
 *  - Only assigned when admin explicitly clicks "Bill" — never automatic
 */

import { supabase } from "./supabase";

/**
 * Generate the next sequential invoice number for the given prefix.
 * Counts all existing orders where invoice_number starts with the prefix.
 *
 * Example: 83 existing "shine%" invoices → returns "shine00084"
 */
export async function generateNextInvoiceNumber(prefix: string): Promise<string> {
  // Count existing invoices with this prefix
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .like("invoice_number", `${prefix}%`);

  if (error) throw new Error(`Failed to count invoices: ${error.message}`);

  const next = (count ?? 0) + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

/**
 * Assign a new sequential invoice number to an order.
 * - If the order already has an invoice_number → returns it unchanged (idempotent)
 * - If not → generates the next number, saves to DB, returns it
 *
 * The UNIQUE INDEX on invoice_number prevents race conditions / duplicates.
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
