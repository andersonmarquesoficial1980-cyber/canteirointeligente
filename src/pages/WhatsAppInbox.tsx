import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, MessageCircle, Search, Send, CheckCheck,
  Clock, User, ChevronRight, X, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SUPABASE_FUNCTIONS_URL = "https://ucgcqexunnsrffzrfhqu.supabase.co/functions/v1";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjZ2NxZXh1bm5zcmZmenJmaHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTYzODIsImV4cCI6MjA4Nzg5MjM4Mn0.p4nBtBDqpEuhJamtK9O1PiljQ-rU2StmbkWsbZRir5o";
const INSTANCE = "fremix-rh";

interface Conversation {
  id: string;
  remote_jid: string;
  remote_name: string;
  remote_phone: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  status: string;
  employee_id?: string;
  employees?: { name: string; matricula: string };
}

interface Message {
  id: string;
  body: string;
  from_me: boolean;
  timestamp: number;
  media_type?: string;
  created_at: string;
}

function fmtTime(ts?: number | null, iso?: string | null): string {
  const d = ts ? new Date(ts * 1000) : iso ? new Date(iso) : null;
  if (!d) return "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString("pt-BR", { weekday: "short" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg,#0055AA,#00C6FF)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 800, fontSize: size * 0.35, flexShrink: 0,
      fontFamily: "Montserrat"
    }}>{initials}</div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function WhatsAppInbox() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"all" | "open" | "unread">("all");
  const msgEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("wha_conversations")
      .select("*, employees(name, matricula)")
      .eq("company_id", COMPANY_ID)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (data) setConversations(data as any);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from("wha_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("timestamp", { ascending: true })
      .limit(100);
    if (data) setMessages(data as any);
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);
    // Marcar como lido
    supabase.from("wha_conversations").update({ unread_count: 0 }).eq("id", selected.id);
    setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, unread_count: 0 } : c));
  }, [selected, loadMessages]);

  // Polling a cada 5s
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (selected) loadMessages(selected.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [selected, loadConversations, loadMessages]);

  async function sendMessage() {
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    const msg = text.trim();
    setText("");

    try {
      // Enviar via túnel HTTPS
      const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/whatsapp-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ number: selected.remote_phone, text: msg, conversation_id: selected.id }),
      });

      const result = await resp.json().catch(() => ({}));
      console.log('Send response:', resp.status, result);
      if (resp.ok || result?.ok) {
        await loadMessages(selected.id);
        await loadConversations();
      } else {
        console.error('Send failed:', result);
        alert('Erro ao enviar: ' + (result?.error || resp.status));
      }
    } catch (e) { console.error(e); }
    setSending(false);
  }

  const filtrados = conversations.filter(c => {
    const matchBusca = !busca ||
      c.remote_name?.toLowerCase().includes(busca.toLowerCase()) ||
      c.remote_phone?.includes(busca);
    if (!matchBusca) return false;
    if (filtro === "unread") return c.unread_count > 0;
    if (filtro === "open") return c.status === "open";
    return true;
  });

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ maxHeight: "100vh", overflow: "hidden" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md shrink-0">
        <button onClick={() => navigate("/gestao-pessoas")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">WhatsApp RH</span>
          <span className="block text-[10px] text-primary-foreground/70">
            {conversations.length} conversas {totalUnread > 0 ? `· ${totalUnread} não lidas` : ""}
          </span>
        </div>
        <button onClick={loadConversations} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 60px)" }}>
        {/* Lista de conversas */}
        <div style={{
          width: selected ? 0 : "100%",
          maxWidth: 420,
          borderRight: "1px solid #e5e7eb",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          transition: "width 0.2s",
          flexShrink: 0
        }} className="md:w-96 md:block">

          {/* Busca + filtros */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", background: "white" }}>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af" }} />
              <input
                placeholder="Buscar por nome ou número..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ width: "100%", paddingLeft: 30, height: 36, borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {([["all","Todos"],["unread","Não lidas"],["open","Abertas"]] as const).map(([id,label]) => (
                <button key={id} onClick={() => setFiltro(id)}
                  style={{ flex:1, padding:"4px 0", borderRadius:8, fontSize:11, fontWeight:600, border:"1.5px solid",
                    borderColor: filtro===id?"#0055AA":"#e5e7eb",
                    background: filtro===id?"#e8f0ff":"white",
                    color: filtro===id?"#0055AA":"#6b7280", cursor:"pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <p style={{ textAlign:"center", color:"#9ca3af", padding:"40px 0", fontSize:13 }}>Carregando...</p>
            ) : filtrados.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 16px" }}>
                <MessageCircle size={40} color="#d1d5db" style={{ margin:"0 auto 12px" }} />
                <p style={{ color:"#9ca3af", fontSize:13 }}>Nenhuma conversa ainda</p>
                <p style={{ color:"#d1d5db", fontSize:11, marginTop:4 }}>As mensagens do WhatsApp aparecerão aqui</p>
              </div>
            ) : filtrados.map(conv => (
              <div key={conv.id} onClick={() => setSelected(conv)}
                style={{
                  display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                  borderBottom:"1px solid #f8fafc", cursor:"pointer",
                  background: selected?.id === conv.id ? "#f0f7ff" : "white",
                  transition: "background 0.1s"
                }}
                onMouseEnter={e => { if(selected?.id !== conv.id) e.currentTarget.style.background="#f8fafc"; }}
                onMouseLeave={e => { if(selected?.id !== conv.id) e.currentTarget.style.background="white"; }}>
                <div style={{ position:"relative" }}>
                  <Avatar name={conv.remote_name || "?"} size={44} />
                  {conv.unread_count > 0 && (
                    <span style={{ position:"absolute", top:-4, right:-4, background:"#0055AA", color:"white", borderRadius:10, fontSize:10, fontWeight:800, padding:"1px 5px", minWidth:18, textAlign:"center" }}>
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <p style={{ fontSize:13, fontWeight: conv.unread_count > 0 ? 700 : 500, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160 }}>
                      {conv.employees?.name || conv.remote_name || conv.remote_phone}
                    </p>
                    <p style={{ fontSize:10, color:"#9ca3af", flexShrink:0 }}>{fmtTime(undefined, conv.last_message_at)}</p>
                  </div>
                  <p style={{ fontSize:12, color: conv.unread_count > 0 ? "#374151" : "#9ca3af", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:2, fontWeight: conv.unread_count > 0 ? 600 : 400 }}>
                    {conv.last_message || "..."}
                  </p>
                  {conv.employees && (
                    <p style={{ fontSize:10, color:"#0055AA", marginTop:2 }}>Mat. {conv.employees.matricula}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        {selected ? (
          <div style={{ flex:1, display:"flex", flexDirection:"column", background:"#f0f2f5", overflow:"hidden" }}>
            {/* Header do chat */}
            <div style={{ background:"white", padding:"10px 14px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid #e5e7eb", flexShrink:0 }}>
              <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <ArrowLeft size={18} color="#374151" />
              </button>
              <Avatar name={selected.remote_name || "?"} size={36} />
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:700, color:"#1e293b" }}>
                  {selected.employees?.name || selected.remote_name || selected.remote_phone}
                </p>
                <p style={{ fontSize:11, color:"#9ca3af" }}>
                  {selected.remote_phone}
                  {selected.employees && ` · Mat. ${selected.employees.matricula}`}
                </p>
              </div>
              {selected.employee_id && (
                <button onClick={() => navigate(`/gestao-pessoas/${selected.employee_id}`)}
                  style={{ background:"#e8f0ff", border:"none", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#0055AA", fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                  <User size={12} /> Ver ficha
                </button>
              )}
            </div>

            {/* Mensagens */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 12px", display:"flex", flexDirection:"column", gap:6 }}>
              {messages.length === 0 ? (
                <p style={{ textAlign:"center", color:"#9ca3af", fontSize:12, marginTop:40 }}>Nenhuma mensagem ainda</p>
              ) : messages.map(msg => (
                <div key={msg.id} style={{ display:"flex", justifyContent: msg.from_me ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth:"75%", padding:"8px 12px", borderRadius: msg.from_me ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.from_me ? "#0055AA" : "white",
                    color: msg.from_me ? "white" : "#1e293b",
                    boxShadow:"0 1px 4px rgba(0,0,0,0.08)", fontSize:13
                  }}>
                    <p style={{ margin:0, lineHeight:1.4, wordBreak:"break-word" }}>{msg.body}</p>
                    <p style={{ margin:"4px 0 0", fontSize:10, opacity:0.6, textAlign:"right", display:"flex", alignItems:"center", justifyContent:"flex-end", gap:3 }}>
                      {fmtTime(msg.timestamp)}
                      {msg.from_me && <CheckCheck size={12} />}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={msgEndRef} />
            </div>

            {/* Input */}
            <div style={{ background:"white", padding:"10px 12px", display:"flex", gap:8, alignItems:"center", flexShrink:0, borderTop:"1px solid #e5e7eb" }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Digite uma mensagem..."
                style={{ flex:1, height:40, borderRadius:20, border:"1.5px solid #e5e7eb", padding:"0 16px", fontSize:13, outline:"none" }}
              />
              <button onClick={sendMessage} disabled={!text.trim() || sending}
                style={{ width:40, height:40, borderRadius:"50%", background: text.trim() ? "#0055AA" : "#e5e7eb", border:"none", cursor: text.trim() ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.2s", flexShrink:0 }}>
                {sending ? <Clock size={16} color="white" /> : <Send size={16} color={text.trim() ? "white" : "#9ca3af"} />}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"#f0f2f5" }}>
            <div style={{ textAlign:"center" }}>
              <MessageCircle size={64} color="#d1d5db" style={{ margin:"0 auto 16px" }} />
              <p style={{ color:"#6b7280", fontSize:14, fontWeight:600 }}>Selecione uma conversa</p>
              <p style={{ color:"#9ca3af", fontSize:12, marginTop:4 }}>Clique em uma conversa para abrir</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
