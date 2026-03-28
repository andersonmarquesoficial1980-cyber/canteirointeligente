import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      console.log("❌ Auth failed:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("✅ User authenticated:", user.email);

    const { rdo_id, html_report, subject: customSubject } = await req.json();

    if (!rdo_id || !html_report) {
      return new Response(
        JSON.stringify({ error: "rdo_id and html_report are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get email recipients
    const { data: config, error: configError } = await supabase
      .from("configuracoes_relatorio")
      .select("emails_destino")
      .limit(1)
      .single();

    console.log("📧 Config query result:", JSON.stringify(config), "Error:", configError?.message);

    let emails: string[] = config?.emails_destino || [];
    if (emails.length === 0) {
      emails = ["anderson@fremix.com.br"];
      console.log("⚠️ No emails in config, using fallback:", emails);
    } else {
      console.log("📧 Recipients found:", emails);
    }

    // Use custom subject if provided, otherwise fallback to RDO lookup
    let subject = customSubject;
    if (!subject) {
      const { data: rdo } = await supabase
        .from("rdo_diarios")
        .select("obra_nome, data")
        .eq("id", rdo_id)
        .single();

      subject = rdo
        ? `Novo RDO - Obra: ${rdo.obra_nome} - Data: ${rdo.data}`
        : `Novo RDO - Relatório Diário de Obra`;
    }

    // Check Resend key
    const resendKey = Deno.env.get("RESEND_API_KEY");
    console.log("🔑 RESEND_API_KEY present:", !!resendKey, "Length:", resendKey?.length || 0);

    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via Resend
    console.log("📤 Sending email to:", emails, "Subject:", subject);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RDO Digital <onboarding@resend.dev>",
        to: emails,
        subject,
        html: html_report,
      }),
    });

    const emailData = await emailRes.json();
    console.log("📬 Resend response status:", emailRes.status, "Body:", JSON.stringify(emailData));

    if (!emailRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, email_id: emailData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("💥 Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
