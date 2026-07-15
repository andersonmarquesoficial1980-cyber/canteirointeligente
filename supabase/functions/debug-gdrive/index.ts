import { createSign, createPrivateKey } from "node:crypto";
import { Buffer } from "node:buffer";

Deno.serve(async (_req) => {
  try {
    const sa = JSON.parse(Deno.env.get("GDRIVE_SERVICE_ACCOUNT") ?? "{}");

    function b64url(buf: Buffer): string {
      return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }

    const now = Math.floor(Date.now() / 1000);
    const headerB64  = b64url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
    const payloadB64 = b64url(Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })));
    const unsigned = `${headerB64}.${payloadB64}`;

    const pk = createPrivateKey({ key: sa.private_key, format: "pem", type: "pkcs8" });
    const signer = createSign("SHA256");
    signer.update(unsigned);
    const jwt = `${unsigned}.${b64url(signer.sign(pk))}`;

    // Tentar endpoint alternativo do Google
    const res = await fetch("https://www.googleapis.com/oauth2/v4/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth2:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();

    return new Response(JSON.stringify({
      ok: !!data.access_token,
      token_len: data.access_token?.length,
      error: data.error,
      error_desc: data.error_description,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});