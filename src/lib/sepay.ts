import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { appConfig } from "./config";

const numericValue = z.union([z.number(), z.string()]).transform((value) => Number(value));

export const sepayPayloadSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    transactionId: z.union([z.string(), z.number()]).optional(),
    referenceCode: z.string().optional().nullable(),
    gateway: z.string().optional().default(""),
    transactionDate: z.string().optional(),
    accountNumber: z.string().optional().default(""),
    code: z.string().optional().nullable(),
    content: z.string().optional().default(""),
    transferType: z.string().optional().default("in"),
    transferAmount: numericValue.optional(),
    amount: numericValue.optional(),
  })
  .passthrough();

export function verifySepaySignature(rawBody: string, headers: Headers) {
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production" && process.env.SEPAY_ALLOW_UNSIGNED_WEBHOOKS === "true";
  }

  const signature = headers.get("x-sepay-signature") ?? "";
  const timestamp = headers.get("x-sepay-timestamp") ?? "";
  const timestampNumber = Number(timestamp);
  if (!timestampNumber || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

  const expected = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function extractOrderCode(code: string | null | undefined, content: string) {
  if (code?.toUpperCase().startsWith(appConfig.paymentPrefix)) return code.toUpperCase();
  const pattern = new RegExp(`${appConfig.paymentPrefix}[A-Z0-9]{6,12}`, "i");
  return content.match(pattern)?.[0]?.toUpperCase() ?? null;
}

export function buildSepayQrUrl(orderCode: string, amount: number) {
  if (!appConfig.bankAccount || !appConfig.bankName) return null;
  const params = new URLSearchParams({
    acc: appConfig.bankAccount,
    bank: appConfig.bankName,
    amount: String(amount),
    des: orderCode,
    template: "compact",
  });
  return `https://vietqr.app/img?${params}`;
}
