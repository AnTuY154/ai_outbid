import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { processPayment } from "@/lib/repository";
import {
  extractOrderCode,
  sepayPayloadSchema,
  verifySepaySignature,
} from "@/lib/sepay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySepaySignature(rawBody, request.headers)) {
    return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = sepayPayloadSchema.parse(JSON.parse(rawBody));
    const transferType = payload.transferType.toLowerCase();
    if (transferType && !["in", "credit", "money_in"].includes(transferType)) {
      return NextResponse.json({ success: true, ignored: "not_incoming" });
    }

    const orderCode = extractOrderCode(payload.code, payload.content);
    if (!orderCode) return NextResponse.json({ success: true, ignored: "missing_order_code" });

    if (
      appConfig.bankAccount &&
      payload.accountNumber &&
      payload.accountNumber.replace(/\s/g, "") !== appConfig.bankAccount.replace(/\s/g, "")
    ) {
      return NextResponse.json({ success: true, ignored: "wrong_bank_account" });
    }

    const amount = payload.transferAmount ?? payload.amount;
    const transactionId = String(
      payload.id ?? payload.transactionId ?? payload.referenceCode ?? "",
    );
    if (!amount || amount <= 0 || !transactionId) {
      return NextResponse.json({ success: false, message: "Invalid transaction payload" }, { status: 400 });
    }

    const parsedDate = payload.transactionDate ? new Date(payload.transactionDate) : new Date();
    const paidAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const result = await processPayment({
      orderCode,
      transactionId,
      amount,
      bankAccount: payload.accountNumber,
      content: payload.content,
      paidAt,
      payload: payload as Record<string, unknown>,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
