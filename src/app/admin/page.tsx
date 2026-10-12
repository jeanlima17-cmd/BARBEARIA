"use client";

import { useEffect, useState } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Scissors,
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Plus,
  MessageCircle,
  CheckCircle,
  XCircle,
  Settings as SettingsIcon,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  BarbershopSettings,
  Service,
  Appointment,
} from "@/types/database";
import {
  formatCurrency,
  formatPhoneMask,
  cleanPhone,
  getWhatsAppReminderLink,
} from "@/lib/utils";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"agenda" | "config">("agenda");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<BarbershopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Inicializa data atual no cliente
  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  // Modal Encaixe Rápido
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInServiceId, setWalkInServiceId] = useState("");
  const [walkInTime, setWalkInTime] = useState("");
  const [walkInClientName, setWalkInClientName] = useState("");
  const [walkInClientPhone, setWalkInClientPhone] = useState("");
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);

  // Formulário Configurações
  const [cfgName, setCfgName] = useState("");
  const [cfgPhone, setCfgPhone] = useState("");
  const [cfgAddress, setCfgAddress] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  // Carregar Dados Iniciais
  useEffect(() => {
    async function fetchInitial() {
      try {
        const [settingsRes, servicesRes] = await Promise.all([
          supabase.from("barbershop_settings").select("*").limit(1).maybeSingle(),
          supabase.from("services").select("*").eq("active", true),
        ]);

        if (settingsRes.data) {
          setSettings(settingsRes.data);
          setCfgName(settingsRes.data.name);
          setCfgPhone(formatPhoneMask(settingsRes.data.phone));
          setCfgAddress(settingsRes.data.address || "");
        }
        if (servicesRes.data) {
          setServices(servicesRes.data);
          if (servicesRes.data.length > 0) {
            setWalkInServiceId(servicesRes.data[0].id);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados iniciais:", err);
      }
    }

    fetchInitial();
  }, []);

  // Buscar Agendamentos do Dia
  const fetchAppointments = async () => {
    if (!selectedDate) return;
    try {
      setLoading(true);

      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("appointments")
        .select("*, services(*)")
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;
      setAppointments(data as Appointment[] || []);
    } catch (err) {
      console.error("Erro ao carregar agendamentos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate]);

  // Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-appointments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  // Alterar Status do Agendamento
  const handleUpdateStatus = async (id: string, newStatus: "completed" | "cancelled") => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      fetchAppointments();
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      alert("Não foi possível atualizar o status.");
    }
  };

  // Criar Encaixe Rápido
  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInServiceId || !walkInTime || !selectedDate) return;

    try {
      setSubmittingWalkIn(true);
      const service = services.find((s) => s.id === walkInServiceId);
      const duration = service ? service.duration_minutes : 30;

      const [hours, minutes] = walkInTime.split(":").map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);

      const endTime = new Date(startTime.getTime() + duration * 60000);

      const newAppt = {
        service_id: walkInServiceId,
        client_name: walkInClientName.trim() || "Cliente Presencial (Encaixe)",
        client_phone: walkInClientPhone ? cleanPhone(walkInClientPhone) : null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: "scheduled" as const,
        is_walk_in: true,
      };

      const { error } = await supabase.from("appointments").insert(newAppt);
      if (error) throw error;

      setShowWalkInModal(false);
      setWalkInClientName("");
      setWalkInClientPhone("");
      setWalkInTime("");
      fetchAppointments();
    } catch (err) {
      console.error("Erro ao criar encaixe:", err);
      alert("Erro ao criar encaixe.");
    } finally {
      setSubmittingWalkIn(false);
    }
  };

  // Salvar Configurações
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      setSavingConfig(true);
      const { error } = await supabase
        .from("barbershop_settings")
        .update({
          name: cfgName,
          phone: cleanPhone(cfgPhone),
          address: cfgAddress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);

      if (error) throw error;
      alert("Configurações salvas com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
      alert("Erro ao salvar.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Próximos 5 dias para navegação rápida
  const quickDays = selectedDate
    ? Array.from({ length: 5 }, (_, i) => addDays(selectedDate, i))
    : [];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      {/* Topo do Painel */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">Painel do Barbeiro</h1>
              <p className="text-[11px] text-neutral-400">{settings?.name || "Minha Barbearia"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === "agenda" ? "config" : "agenda")}
              className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                activeTab === "config"
                  ? "bg-amber-500 text-black border-amber-400 font-bold"
                  : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700"
              }`}
              title="Configurações"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button
              onClick={fetchAppointments}
              className="p-2 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-2xl mx-auto px-4 pt-4">
        {activeTab === "agenda" ? (
          <div className="space-y-4">
            {/* Seletor de Datas */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {quickDays.map((day) => {
                const isSelected = selectedDate ? isSameDay(selectedDate, day) : false;
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`flex-shrink-0 px-3.5 py-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "bg-amber-500 text-black border-amber-400 font-bold shadow-md shadow-amber-500/10"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div className="text-[10px] uppercase font-semibold">
                      {format(day, "EEE", { locale: ptBR })}
                    </div>
                    <div className="text-sm font-bold mt-0.5">
                      {format(day, "dd/MM")}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Resumo da Agenda */}
            <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
              <span>
                Agendamentos em{" "}
                <strong className="text-white">
                  {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : ""}
                </strong>
              </span>
              <span>{appointments.filter((a) => a.status !== "cancelled").length} ativos</span>
            </div>

            {/* Lista Cronológica de Agendamentos */}
            {loading ? (
              <div className="py-16 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                Carregando horários...
              </div>
            ) : appointments.length > 0 ? (
              <div className="space-y-2.5">
                {appointments.map((appt) => {
                  const isCancelled = appt.status === "cancelled";
                  const isCompleted = appt.status === "completed";
                  const startTime = new Date(appt.start_time);

                  return (
                    <div
                      key={appt.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isCancelled
                          ? "bg-neutral-900/40 border-neutral-800/40 opacity-50"
                          : isCompleted
                          ? "bg-emerald-950/20 border-emerald-800/30"
                          : "bg-neutral-900 border-neutral-800 shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-amber-400">
                              {format(startTime, "HH:mm")}
                            </span>
                            {appt.is_walk_in && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium border border-amber-500/30">
                                Encaixe
                              </span>
                            )}
                            {isCompleted && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium border border-emerald-500/30">
                                Concluído
                              </span>
                            )}
                            {isCancelled && (
                              <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium border border-red-500/30">
                                Cancelado
                              </span>
                            )}
                          </div>

                          <h3 className="font-semibold text-white text-sm mt-1">
                            {appt.client_name || "Cliente sem nome"}
                          </h3>

                          <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                            <span>{appt.services?.name || "Serviço"}</span>
                            {appt.services?.price && (
                              <span className="text-neutral-500">• {formatCurrency(appt.services.price)}</span>
                            )}
                          </div>
                        </div>

                        {/* Ações Rápidas */}
                        {!isCancelled && !isCompleted && (
                          <div className="flex items-center gap-1.5">
                            {/* Disparar Lembrete via WhatsApp */}
                            {appt.client_phone && (
                              <a
                                href={getWhatsAppReminderLink(
                                  appt.client_phone,
                                  appt.client_name || "Cliente",
                                  appt.services?.name || "Serviço",
                                  startTime,
                                  settings?.name || "Barbearia"
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/60"
                                title="Enviar lembrete no WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            )}

                            {/* Concluir */}
                            <button
                              onClick={() => handleUpdateStatus(appt.id, "completed")}
                              className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                              title="Marcar como Concluído"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>

                            {/* Cancelar */}
                            <button
                              onClick={() => handleUpdateStatus(appt.id, "cancelled")}
                              className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                              title="Cancelar Horário"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-neutral-900/40 rounded-2xl border border-neutral-800/60 p-6">
                <CalendarIcon className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-white">Nenhum agendamento hoje</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Clique no botão abaixo para adicionar um encaixe presencial rápido.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ABA DE CONFIGURAÇÕES */
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-base font-semibold text-white">Configurações da Barbearia</h2>
              <p className="text-xs text-neutral-400">
                Ajuste os dados que aparecem para seus clientes
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1 block">
                  Nome da Barbearia
                </label>
                <input
                  type="text"
                  required
                  value={cfgName}
                  onChange={(e) => setCfgName(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1 block">
                  WhatsApp para Confirmação dos Clientes
                </label>
                <input
                  type="tel"
                  required
                  value={cfgPhone}
                  onChange={(e) => setCfgPhone(formatPhoneMask(e.target.value))}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Número que receberá as mensagens dos clientes na tela de confirmação.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1 block">
                  Endereço Físico
                </label>
                <input
                  type="text"
                  value={cfgAddress}
                  onChange={(e) => setCfgAddress(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/10 text-sm mt-2 disabled:opacity-50"
              >
                {savingConfig ? "Salvando..." : "Salvar Configurações"}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Botão Flutuante: Novo Encaixe */}
      {activeTab === "agenda" && (
        <div className="fixed bottom-6 right-6 z-30">
          <button
            onClick={() => setShowWalkInModal(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-3 rounded-full shadow-xl shadow-amber-500/20 transition-all hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm">Novo Encaixe</span>
          </button>
        </div>
      )}

      {/* Modal de Encaixe Rápido */}
      {showWalkInModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-white">Novo Encaixe Rápido</h3>
              <p className="text-xs text-neutral-400">
                Trave o horário em segundos. Nome e telefone são opcionais.
              </p>
            </div>

            <form onSubmit={handleCreateWalkIn} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1 block">
                  Serviço
                </label>
                <select
                  value={walkInServiceId}
                  onChange={(e) => setWalkInServiceId(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes}m)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1 block">
                  Horário de Início
                </label>
                <input
                  type="time"
                  required
                  value={walkInTime}
                  onChange={(e) => setWalkInTime(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1 block">
                  Nome do Cliente (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlos (ou deixe em branco)"
                  value={walkInClientName}
                  onChange={(e) => setWalkInClientName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1 block">
                  Telefone / WhatsApp (opcional)
                </label>
                <input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={walkInClientPhone}
                  onChange={(e) => setWalkInClientPhone(formatPhoneMask(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingWalkIn}
                  className="w-2/3 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
                >
                  {submittingWalkIn ? "Salvando..." : "Confirmar Encaixe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
