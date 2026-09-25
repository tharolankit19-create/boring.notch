import DodoPayments from "dodopayments";
import { commerceConfig, required } from "./config";

function environment(): "live_mode" | "test_mode" {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "test_mode" ? "test_mode" : "live_mode";
}

export function dodo() {
  return new DodoPayments({
    bearerToken: required("DODO_PAYMENTS_API_KEY"),
    webhookKey: required("DODO_PAYMENTS_WEBHOOK_KEY"),
    environment: environment()
  });
}

export async function createFoundingCheckout() {
  const session = await dodo().checkoutSessions.create({
    product_cart: [{ product_id: commerceConfig.productId, quantity: 1 }],
    return_url: `${commerceConfig.appUrl}/download`
  });
  if (!session.checkout_url) throw new Error("Dodo did not return a checkout URL.");
  return session;
}

type PaymentShape = {
  payment_id?: string | null;
  checkout_session_id?: string | null;
  total_amount?: number | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  customer?: { email?: string | null } | null;
  product_cart?: Array<{ product_id?: string | null; quantity?: number | null }> | null;
};

export function validateFoundingPayment(payment: PaymentShape) {
  const productMatch = payment.product_cart?.some(
    item => item.product_id === commerceConfig.productId && (item.quantity ?? 0) === 1
  );
  const amount = payment.total_amount ?? payment.amount;
  if (!productMatch) throw new Error("Wrong product.");
  if (amount !== commerceConfig.amountMinor) throw new Error("Wrong amount.");
  if ((payment.currency ?? "").toUpperCase() !== commerceConfig.currency) throw new Error("Wrong currency.");
  if (payment.status && payment.status !== "succeeded") throw new Error("Payment not succeeded.");
  if (!payment.payment_id) throw new Error("Payment id missing.");
  if (!payment.customer?.email) throw new Error("Purchaser email missing.");

  return {
    paymentId: payment.payment_id,
    checkoutSessionId: payment.checkout_session_id ?? null,
    email: payment.customer.email.trim().toLowerCase(),
    amount: amount!,
    currency: commerceConfig.currency,
    productId: commerceConfig.productId
  };
}

export async function reconcileCheckout(sessionId: string) {
  const client = dodo();
  const session = await client.checkoutSessions.retrieve(sessionId);
  if (session.payment_status !== "succeeded" || !session.payment_id) return null;
  const payment = await client.payments.retrieve(session.payment_id);
  return validateFoundingPayment(payment as PaymentShape);
}
