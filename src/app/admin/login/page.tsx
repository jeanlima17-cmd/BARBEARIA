"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors, Lock, Mail, AlertCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrorMsg("E-mail ou senha incorretos.");
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      if (data.session) {
        router.push("/admin");
      }
    } catch (err: any) {
      setErrorMsg("Ocorreu um erro ao tentar entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Topo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-3 shadow-lg shadow-amber-500/5">
            <Scissors className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Acesso do Barbeiro</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Entre com suas credenciais para gerenciar a agenda
          </p>
        </div>

        {/* Card do Formulário */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-300 mb-1.5 block flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-500" />
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="barbeiro@exemplo.com"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 mb-1.5 block flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                Senha
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 text-sm mt-2 disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Acessar Painel"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <a
            href="/"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            ← Voltar para a página de agendamentos
          </a>
        </div>
      </div>
    </main>
  );
}
