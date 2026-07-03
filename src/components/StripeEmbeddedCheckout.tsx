import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";

type Props = {
  priceId: string;
  returnUrl?: string;
};

export function StripeEmbeddedCheckoutBlock({ priceId, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const res = await createCheckoutSession({
      data: {
        priceId,
        returnUrl: returnUrl || window.location.href,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in res) throw new Error(res.error);
    if (!res.clientSecret) throw new Error("No client secret");
    return res.clientSecret;
  };

  return (
    <div id="checkout" className="rounded-lg overflow-hidden">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

export function PaymentTestModeBanner() {
  const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
  if (!token) {
    return (
      <div className="w-full bg-red-100 border-b border-red-300 px-4 py-2 text-center text-sm text-red-800">
        Production checkout is not configured. Complete payments go-live to accept real payments.
      </div>
    );
  }
  if (token.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
        Test mode. Use card <code>4242 4242 4242 4242</code>, any future expiry, any CVC.
      </div>
    );
  }
  return null;
}
