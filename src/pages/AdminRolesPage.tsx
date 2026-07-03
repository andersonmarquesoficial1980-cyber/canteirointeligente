import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";

interface AdminRole {
  id: string;
  name: string;
  description: string;
  is_system_role: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data, error: err } = await supabase
          .from("admin_roles")
          .select("*")
          .order("created_at", { ascending: false });

        if (err) {
          setError(err.message);
        } else {
          setRoles(data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p>Carregando roles...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen text-red-600">
          <p>Erro: {error}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Admin Roles</h1>

        <div className="bg-white rounded-lg shadow">
          {roles.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              Nenhum role criado ainda.
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="px-6 py-3 text-left">Nome</th>
                  <th className="px-6 py-3 text-left">Descrição</th>
                  <th className="px-6 py-3 text-left">Sistema</th>
                  <th className="px-6 py-3 text-left">Ativo</th>
                  <th className="px-6 py-3 text-left">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-3 font-semibold">{role.name}</td>
                    <td className="px-6 py-3">{role.description}</td>
                    <td className="px-6 py-3">
                      {role.is_system_role ? "✓" : ""}
                    </td>
                    <td className="px-6 py-3">
                      {role.active ? "✓" : "✗"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(role.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
