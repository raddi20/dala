import { cardClass } from "@/components/ui";
import type { PaymentMode } from "@/lib/payments/rules";

const webhookUrl = "https://dala-sigma.vercel.app/api/payments/flutterwave";

export function PaymentSetup({ mode, webhookReady }: { mode: PaymentMode; webhookReady: boolean }) {
  if (mode === "live") {
    return (
      <div className={`${cardClass} p-4 text-sm text-ink/80`}>
        <p>Checkout opens on Flutterwave. M-Pesa is offered on Kenyan shilling prices. Card covers Nairobi and London. Dala does not see the card number.</p>
        {webhookReady ? null : (
          <p className="mt-2">
            <span className="font-semibold">FLW_WEBHOOK_HASH</span> is not set. The upgrade still applies when the buyer returns here. Set the hash so a closed tab still completes.
          </p>
        )}
      </div>
    );
  }

  if (mode === "test") {
    return (
      <div className="rounded-xl border border-lake/25 bg-teal-soft px-3.5 py-3 text-sm text-lake-dark">
        <p className="font-semibold">Test mode</p>
        <p className="mt-1 text-ink/80">
          The secret key is a Flutterwave test key. Checkout uses the sandbox. No live M-Pesa prompt and no live card charge.
        </p>
        <p className="mt-2 text-ink/80">
          Card <span className="font-semibold">5531 8866 5214 2950</span>, expiry <span className="font-semibold">09/32</span>, CVV{" "}
          <span className="font-semibold">564</span>, PIN <span className="font-semibold">3310</span>, OTP{" "}
          <span className="font-semibold">12345</span>. For M-Pesa, use a number shaped like 254712345678. The sandbox does not bill Safaricom.
        </p>
        {webhookReady ? null : (
          <p className="mt-2 text-ink/80">
            <span className="font-semibold">FLW_WEBHOOK_HASH</span> is not set. Returning from Flutterwave still completes the upgrade. Set the hash so a closed tab does too.
          </p>
        )}
      </div>
    );
  }

  if (mode === "invalid") {
    return (
      <div className="rounded-xl border border-danger/25 bg-red-50 px-3.5 py-3 text-sm text-danger" role="alert">
        <span className="font-semibold">FLW_SECRET_KEY</span> is set, but it does not look like a Flutterwave secret. Test keys start with{" "}
        <span className="font-semibold">FLWSECK_TEST</span>. Live keys start with <span className="font-semibold">FLWSECK-</span>.
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-4 text-sm text-ink/80`}>
      <p className="font-semibold text-navy">Payments are off until Flutterwave keys are set</p>
      <p className="mt-1">Checkout stays disabled. Nothing is marked paid and nothing is charged.</p>
      <ol className="mt-3 grid list-decimal gap-2 pl-5">
        <li>In the Flutterwave dashboard, copy the test secret key and choose a webhook secret hash.</li>
        <li>
          Locally, add <span className="font-semibold">FLW_SECRET_KEY</span> and <span className="font-semibold">FLW_WEBHOOK_HASH</span> to{" "}
          <span className="font-semibold">.env</span>, then restart <span className="font-semibold">npm run dev</span>.
        </li>
        <li>
          On Vercel, add those two plus <span className="font-semibold">APP_URL</span> ={" "}
          <span className="font-semibold">https://dala-sigma.vercel.app</span> under Settings → Environment Variables.
        </li>
        <li>
          Point the Flutterwave webhook at <span className="font-semibold">{webhookUrl}</span> and use the same secret hash. Turn on preferred payment methods so M-Pesa and card can be limited per checkout.
        </li>
        <li>
          Redeploy with <span className="font-semibold">cd ~/dala && git pull && npx vercel --prod</span>.
        </li>
        <li>
          For real money later, replace the secret with the live key (<span className="font-semibold">FLWSECK-</span>, not{" "}
          <span className="font-semibold">FLWSECK_TEST</span>) and redeploy. The test-mode banner goes away.
        </li>
      </ol>
      <p className="mt-3">
        <span className="font-semibold">FLW_PUBLIC_KEY</span> can sit beside the secret. This checkout uses Flutterwave&apos;s hosted page, so the public key is not sent to the browser.
      </p>
    </div>
  );
}
