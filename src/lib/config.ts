import "server-only";

export const appConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  minimumBid: Number(process.env.MINIMUM_BID_AMOUNT ?? 50_000),
  orderExpiryMinutes: Number(process.env.ORDER_EXPIRY_MINUTES ?? 30),
  paymentPrefix: (process.env.SEPAY_PAYMENT_PREFIX ?? "KM").toUpperCase(),
  bankAccount: process.env.SEPAY_BANK_ACCOUNT ?? "",
  bankName: process.env.SEPAY_BANK_NAME ?? "",
  accountName: process.env.SEPAY_ACCOUNT_NAME ?? "",
};

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
