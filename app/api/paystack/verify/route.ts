import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { finalizeOrderFromPaystack } from "@/lib/orders";

// Called by the checkout page right after Paystack's popup reports success.
// It only takes a reference — the order (with its server-computed total)
// already exists from /api/checkout/create-order, so there's nothing here
// for the browser to lie about.
export async function POST(req: NextRequest) {
  try {
    const { reference } = await req.json();
    if (!reference) {
      return NextResponse.json({ verified: false, error: "Missing reference" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const result = await finalizeOrderFromPaystack(supabaseAdmin, reference);
    return NextResponse.json(result, { status: result.verified ? 200 : 400 });
  } catch (err) {
    console.error("Paystack verification error:", err);
    return NextResponse.json({ verified: false, error: "Verification failed" }, { status: 500 });
  }
}