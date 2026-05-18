import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      throw new Error("ASAAS_API_KEY não configurada.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Usuário não autenticado");
    const token = authHeader.replace("Bearer ", "");
    
    // Validar quem tá chamando
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Token inválido");

    const body = await req.json();
    const { plano, valor, company_id, cpfCnpj } = body;

    if (!plano || !valor || !company_id || !cpfCnpj) {
      throw new Error("Dados incompletos para assinar. CPF/CNPJ é obrigatório.");
    }

    // Busca os dados do cliente para criar a cobrança no Asaas
    const { data: company } = await supabaseClient.from("companies").select("*").eq("id", company_id).single();
    if (!company) throw new Error("Empresa não encontrada.");

    // Busca o email do administrador que está logado
    const { data: profile } = await supabaseClient.from("profiles").select("email, nome_completo").eq("user_id", user.id).single();

    // 1. Verificar se o cliente já existe no Asaas (banco local)
    let { data: sub } = await supabaseClient.from("subscriptions").select("*").eq("company_id", company_id).maybeSingle();
    let asaas_customer_id = sub?.asaas_customer_id;

    // 2. Se não existir, criar cliente no Asaas
    if (!asaas_customer_id) {
      const customerReq = await fetch("https://api.asaas.com/v3/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
        body: JSON.stringify({
          name: company.name || profile.nome_completo || "Empresa Workflux",
          email: profile.email,
          cpfCnpj: cpfCnpj
        }),
      });
      const customerData = await customerReq.json();
      if (customerData.errors) throw new Error(customerData.errors[0].description);
      
      asaas_customer_id = customerData.id;
    }

    // 3. Criar a cobrança (Assinatura Recorrente) no Asaas
    const subReq = await fetch("https://api.asaas.com/v3/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
      body: JSON.stringify({
        customer: asaas_customer_id,
        billingType: "UNDEFINED", // Cliente escolhe (BOLETO, PIX ou CARTAO)
        value: valor,
        nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Começa a cobrar a partir de amanhã
        cycle: "MONTHLY",
        description: `Assinatura Mensal Workflux - Plano ${plano}`,
      }),
    });
    
    const subData = await subReq.json();
    if (subData.errors) throw new Error(subData.errors[0].description);

    // 4. Salvar ou atualizar no Supabase
    if (sub) {
      await supabaseClient.from("subscriptions").update({
        asaas_customer_id,
        asaas_subscription_id: subData.id,
        plano,
        valor,
      }).eq("id", sub.id);
    } else {
      await supabaseClient.from("subscriptions").insert({
        company_id,
        asaas_customer_id,
        asaas_subscription_id: subData.id,
        plano,
        valor,
      });
    }

    // 5. Opcional: Criar link de pagamento para a primeira cobrança já gerada (se quiser pagar na hora)
    // O Asaas devolve no objeto `subData` um link genérico, mas para enviar o cliente pro checkout
    // Pegamos a primeira fatura gerada.
    const invReq = await fetch(`https://api.asaas.com/v3/subscriptions/${subData.id}/payments`, {
      method: "GET",
      headers: { "access_token": asaasApiKey }
    });
    const invData = await invReq.json();
    const invoiceUrl = invData.data && invData.data.length > 0 ? invData.data[0].invoiceUrl : null;

    return new Response(
      JSON.stringify({ url: invoiceUrl || "https://www.asaas.com" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Asaas Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
