# Configuração de VAPID (Web Push)

## 1) Gerar chaves VAPID
Use `web-push` localmente para gerar o par de chaves:

```bash
npx web-push generate-vapid-keys
```

Você receberá:
- `publicKey`
- `privateKey`

## 2) Configurar no frontend
No ambiente do app (Vite), defina:

```bash
VITE_VAPID_PUBLIC_KEY=<publicKey>
```

Essa chave é usada pelo hook `usePushNotifications` para criar a subscription no browser.

## 3) Configurar no Supabase (Edge Functions)
No projeto Supabase (`ucgcqexunnsrffzrfhqu`), configure secrets:

```bash
supabase secrets set VAPID_PUBLIC_KEY=<publicKey>
supabase secrets set VAPID_PRIVATE_KEY=<privateKey>
supabase secrets set VAPID_SUBJECT=mailto:suporte@workflux.com.br
```

`VAPID_SUBJECT` pode ser `mailto:<email>` ou URL do sistema.

## 4) Deploy da função
Após configurar os secrets, faça deploy da função:

```bash
supabase functions deploy send-push
```

## 5) Fluxo validado
1. Usuário acessa Home.
2. Hook pede permissão e salva subscription em `push_subscriptions`.
3. Ao criar demanda com `funcionario_solicitado_id`, o app chama `send-push`.
4. A função envia notificação para todas as subscriptions do usuário destino.
