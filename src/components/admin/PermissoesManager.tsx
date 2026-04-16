import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Save, UserCog } from "lucide-react";

interface Usuario {
  id: string;
  email: string;
  nome: string;
}

interface Perms {
  user_id: string;
  is_admin: boolean;
  modulo_obras: boolean;
  modulo_equipamentos: boolean;
  modulo_rh: boolean;
  modulo_carreteiros: boolean;
  modulo_programador: boolean;
  modulo_demandas: boolean;
  modulo_manutencao: boolean;
  modulo_abastecimento: boolean;
  modulo_documentos: boolean;
  modulo_relatorios: boolean;
  modulo_dashboard: boolean;
}

const MODULOS = [
  { key: "modulo_obras", label: "WF Obras" },
  { key: "modulo_equipamentos", label: "WF Equipamentos" },
  { key: "modulo_rh", label: "WF RH" },
  { key: "modulo_carreteiros", label: "WF Carreteiros" },
  { key: "modulo_programador", label: "WF Programador" },
  { key: "modulo_demandas", label: "WF Demandas" },
  { key: "modulo_manutencao", label: "WF Manutenção" },
  { key: "modulo_abastecimento", label: "WF Abastecimento" },
  { key: "modulo_documentos", label: "WF Documentos" },
  { key: "modulo_relatorios", label: "WF Relatórios" },
  { key: "modulo_dashboard", label: "Painel Admin" },
];

function emptyPerms(userId: string): Perms {
  return {
    user_id: userId, is_admin: false,
    modulo_obras: false, modulo_equipamentos: false, modulo_rh: false,
    modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false,
    modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false,
    modulo_relatorios: false, modulo_dashboard: false,
  };
}

export default function PermissoesManager() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [permsMap, setPermsMap] = useState<Record<string, Perms>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvoOk, setSalvoOk] = useState<string | null>(null);

  useEffect(() => { buscarDados(); }, []);

  async function buscarDados() {
    setLoading(true);
    const [{ data: profiles }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("id, email, name").order("name"),
      supabase.from("user_permissions").select("*"),
    ]);

    const users: Usuario[] = (profiles || []).map((p: any) => ({
      id: p.id, email: p.email || "", nome: p.name || p.email || p.id,
    }));
    setUsuarios(users);

    const map: Record<string, Perms> = {};
    (perms || []).forEach((p: any) => { map[p.user_id] = p; });
    setPermsMap(map);
    setLoading(false);
  }

  async function salvar(userId: string) {
    setSalvando(userId);
    const perms = permsMap[userId] || emptyPerms(userId);
    await supabase.from("user_permissions").upsert({ ...perms, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSalvando(null);
    setSalvoOk(userId);
    setTimeout(() => setSalvoOk(null), 2000);
  }

  function toggle(userId: string, field: keyof Perms) {
    setPermsMap(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || emptyPerms(userId)), [field]: !((prev[userId] || emptyPerms(userId))[field]) },
    }));
  }

  function marcarTodos(userId: string, valor: boolean) {
    const perms = permsMap[userId] || emptyPerms(userId);
    const updated = { ...perms };
    MODULOS.forEach(m => { (updated as any)[m.key] = valor; });
    setPermsMap(prev => ({ ...prev, [userId]: updated }));
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <UserCog className="w-5 h-5 text-primary" />
        <h2 className="font-display font-bold text-base">Permissões de Usuários</h2>
      </div>

      {usuarios.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-6">Nenhum usuário cadastrado.</p>
      )}

      {usuarios.map(u => {
        const perms = permsMap[u.id] || emptyPerms(u.id);
        const isSalvando = salvando === u.id;
        const isSalvo = salvoOk === u.id;

        return (
          <div key={u.id} className="border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-display font-bold text-sm">{u.nome}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <Button
                size="sm"
                onClick={() => salvar(u.id)}
                disabled={isSalvando}
                className={`gap-1.5 h-8 text-xs ${isSalvo ? "bg-green-600 hover:bg-green-600" : ""}`}
              >
                {isSalvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {isSalvo ? "Salvo!" : "Salvar"}
              </Button>
            </div>

            {/* Admin toggle */}
            <label className="flex items-center gap-2 cursor-pointer bg-primary/5 rounded-xl px-3 py-2">
              <input
                type="checkbox"
                checked={perms.is_admin}
                onChange={() => toggle(u.id, "is_admin")}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-bold text-primary">Administrador (acesso total)</span>
            </label>

            {!perms.is_admin && (
              <>
                <div className="flex gap-2">
                  <button onClick={() => marcarTodos(u.id, true)} className="text-xs text-primary underline">Marcar todos</button>
                  <span className="text-xs text-muted-foreground">·</span>
                  <button onClick={() => marcarTodos(u.id, false)} className="text-xs text-muted-foreground underline">Desmarcar todos</button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {MODULOS.map(m => (
                    <label key={m.key} className="flex items-center gap-2 cursor-pointer bg-secondary/50 rounded-xl px-3 py-2">
                      <input
                        type="checkbox"
                        checked={(perms as any)[m.key] || false}
                        onChange={() => toggle(u.id, m.key as keyof Perms)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-xs font-medium">{m.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
