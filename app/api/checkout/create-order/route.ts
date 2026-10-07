import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPendingOrder } from "@/lib/orders";

// Call this BEFORE opening the Paystack popup. It figures out who's really
// logged in (from the Supabase access token, never from anything the client
// claims), recomputes the total from the database, and returns the
// reference + amount to actually charge.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // This is the only place the user's identity comes from — the verified
    // session token, not a userId/email field in the request body.
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user?.email) {
      return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
    }

    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    const customer = body?.customer ?? {};

    const order = await createPendingOrder(supabaseAdmin, {
      userId: userData.user.id,
      email: userData.user.email,
      customer,
      items,
    });

    return NextResponse.json({
      reference: order.reference,
      amount: order.totalKobo,
      email: userData.user.email,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not create order.";
    console.error("create-order error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}