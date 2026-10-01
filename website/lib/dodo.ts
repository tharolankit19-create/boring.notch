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

async function assertFoundingCheckoutPrice(client: DodoPayments) {
  if (commerceConfig.amountMinor !== 500 || commerceConfig.currency !== "USD") {
    throw new Error("NotchSignal founding checkout must be configured as exactly USD 5.00.");
  }

  const preview = await client.checkoutSessions.preview({
    product_cart: [{ product_id: commerceConfig.productId, quantity: 1 }],
    billing_currency: "USD",
    feature_flags: {
      allow_currency_selection: false,
      allow_discount_code: false,
      allow_phone_number_collection: false,
      allow_tax_id: false
    }
  });

  const item = preview.product_cart.find(
    product => product.product_id === commerceConfig.productId && product.quantity === 1
  );

  if (!item || preview.product_cart.length !== 1) {
    throw new Error("Dodo checkout preview did not match the NotchSignal product.");
  }
  if (item.is_subscription) {
    throw new Error("NotchSignal founding access must be a one-time product.");
  }
  if (!item.tax_inclusive) {
    throw new Error("NotchSignal product must be tax-inclusive so the buyer total stays at $5.");
  }
  if (preview.currency !== "USD" || preview.current_breakup.total_amount !== 500) {
    throw new Error("Dodo checkout preview is not exactly USD 5.00.");
  }
}

export async function createFoundingCheckout() {
  const client = dodo();
  await assertFoundingCheckoutPrice(client);

  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: commerceConfig.productId, quantity: 1 }],
    billing_currency: "USD",
    return_url: `${commerceConfig.appUrl}/download`,
    cancel_url: `${commerceConfig.appUrl}/#pricing`,
    feature_flags: {
      allow_currency_selection: false,
      allow_discount_code: false,
      allow_phone_number_collection: false,
      allow_tax_id: false,
      redirect_immediately: true
    },
    customization: {
      theme: "light",
      show_order_details: true,
      theme_config: {
        radius: "10px",
        font_size: "md",
        font_weight: "medium",
        pay_button_text: "Buy NotchSignal — $5",
        light: {
          bg_primary: "#ffffff",
          bg_secondary: "#f5f5f3",
          text_primary: "#101114",
          text_secondary: "#6f7278",
          border_primary: "#dedfe2",
          button_primary: "#0c0d0f",
          button_primary_hover: "#222428",
          button_text_primary: "#ffffff"
        }
      }
    }
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
  refund_status?: "partial" | "full" | null;
  disputes?: Array<{ dispute_status?: string | null }> | null;
  customer?: { email?: string | null } | null;
  product_cart?: Array<{ product_id?: string | null; quantity?: number | null }> | null;
};

export function validateFoundingPayment(payment: PaymentShape) {
  const cart = payment.product_cart ?? [];
  const productMatch =
    cart.length === 1 &&
    cart[0]?.product_id === commerceConfig.productId &&
    (cart[0]?.quantity ?? 0) === 1;

  const amount = payment.total_amount ?? payment.amount;
  if (!productMatch) throw new Error("Wrong product or quantity.");
  if (amount !== commerceConfig.amountMinor) throw new Error("Wrong amount.");
  if ((payment.currency ?? "").toUpperCase() !== commerceConfig.currency) {
    throw new Error("Wrong currency.");
  }
  if (payment.status && payment.status !== "succeeded") {
    throw new Error("Payment not succeeded.");
  }
  if (payment.refund_status) {
    throw new Error("Payment has a refund and cannot grant download access.");
  }
  const activeDispute = payment.disputes?.some(dispute =>
    dispute.dispute_status &&
    !["dispute_won", "dispute_cancelled"].includes(dispute.dispute_status)
  );
  if (activeDispute) {
    throw new Error("Payment has an unresolved or lost dispute.");
  }
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
