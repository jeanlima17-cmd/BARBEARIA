"use client";

import { useEffect, useState } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Scissors,
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  MapPin,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  BarbershopSettings,
  Service,
  BusinessHour,
  Appointment,
  BlockedTime,
} from "@/types/database";
import {
  formatCurrency,
  formatPhoneMask,
  cleanPhone,
  generateAvailableSlots,
  getWhatsAppConfirmationLink,
} from "@/lib/utils";

export default function BookingPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Dados do banco
  const [settings, setSettings] = useState<BarbershopSettings | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);

  // Seleções do cliente
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // Inicializa data atual apenas no cliente
  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  // Slots disponíveis calculados
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Confirmação final
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  // Carregar dados iniciais
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);

        const [settingsRes, servicesRes, hoursRes] = await Promise.all([
          supabase.from("barbershop_settings").select("*").limit(1).maybeSingle(),
          supabase.from("services").select("*").eq("active", true).order("price"),
          supabase.from("business_hours").select("*"),
        ]);

        if (settingsRes.data) setSettings(settingsRes.data);
        if (servicesRes.data) setServices(servicesRes.data);
        if (hoursRes.data) setBusinessHours(hoursRes.data);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  // Calcular horários disponíveis quando alterar serviço ou data
  useEffect(() => {
    async function fetchSlots() {
      if (!selectedService || !selectedDate) return;

      try {
        setLoadingSlots(true);
        setSelectedSlot(null);

        const dayOfWeek = selectedDate.getDay();
        const bHour = businessHours.find((h) => h.day_of_week === dayOfWeek) || null;

        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const [apptsRes, blocksRes] = await Promise.all([
          supabase
            .from("appointments")
            .select("*")
            .gte("start_time", startOfDay.toISOString())
            .lte("start_time", endOfDay.toISOString())
            .neq("status", "cancelled"),
          supabase
            .from("blocked_times")
            .select("*")
            .gte("start_time", startOfDay.toISOString())
            .lte("start_time", endOfDay.toISOString()),
        ]);

        const slots = generateAvailableSlots({
          date: selectedDate,
          businessHour: bHour,
          serviceDurationMinutes: selectedService.duration_minutes,
          existingAppointments: (apptsRes.data as Appointment[]) || [],
          blockedTimes: (blocksRes.data as BlockedTime[]) || [],
        });

        setAvailableSlots(slots);
      } catch (err) {
        console.error("Erro ao calcular horários:", err);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    fetchSlots();
  }, [selectedService, selectedDate, businessHours]);

  // Dias para exibição rápida (próximos 7 dias)
  const availableDays = selectedDate
    ? Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i))
    : [];

  // Submeter agendamento
  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedSlot || !clientName || !clientPhone) return;

    try {
      setSubmitting(true);

      const [hours, minutes] = selectedSlot.split(":").map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);

      const endTime = new Date(startTime.getTime() + selectedService.duration_minutes * 60000);

      const newAppt = {
        service_id: selectedService.id,
        client_name: clientName.trim(),
        client_phone: cleanPhone(clientPhone),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: "scheduled" as const,
        is_walk_in: false,
      };

      const { data, error } = await supabase
        .from("appointments")
        .insert(newAppt)
        .select()
        .single();

      if (error) throw error;

      setCreatedAppointment(data);
      setStep(4);
    } catch (err) {
      console.error("Erro ao criar agendamento:", err);
      alert("Não foi possível concluir o agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-sm font-medium">Carregando barbearia...</p>
        </div>
      </main>
    );
  }

  const shopName = settings?.name || "Barbearia";
  const shopPhone = settings?.phone || "5549999999999";
  const shopAddress = settings?.address || "Rua Principal, 123";

  return (
    <main className="min-h-screen max-w-md mx-auto p-4 flex flex-col justify-between">
      <div>
        {/* Cabeçalho */}
        <header className="mb-6 text-center pt-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-3 shadow-lg shadow-amber-500/5">
            <Scissors className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{shopName}</h1>
          <p className="text-xs text-neutral-400 flex items-center justify-center gap-1.5 mt-1">
            <MapPin className="w-3.5 h-3.5 text-amber-500/80" />
            {shopAddress}
          </p>
        </header>

        {/* Indicador de Passos */}
        {step < 4 && (
          <div className="flex items-center justify-between mb-6 px-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    step === s
                      ? "bg-amber-500 text-black shadow-md shadow-amber-500/20 ring-4 ring-amber-500/20"
                      : step > s
                      ? "bg-neutral-800 text-amber-400 border border-amber-500/30"
                      : "bg-neutral-900 text-neutral-500 border border-neutral-800"
                  }`}
                >
                  {step > s ? "✓" : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-12 sm:w-16 h-0.5 mx-2 transition-all ${
                      step > s ? "bg-amber-500/40" : "bg-neutral-800"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ETAPA 1: ESCOLHA DO SERVIÇO */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-semibold text-white">Escolha um serviço</h2>
              <p className="text-xs text-neutral-400">Selecione o corte ou procedimento desejado</p>
            </div>

            <div className="space-y-2.5">
              {services.map((srv) => {
                const isSelected = selectedService?.id === srv.id;
                return (
                  <button
                    key={srv.id}
                    onClick={() => setSelectedService(srv)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/40"
                        : "bg-neutral-900/80 border-neutral-800/80 hover:border-neutral-700"
                    }`}
                  >
                    <div>
                      <h3 className="font-medium text-neutral-100 text-sm">{srv.name}</h3>
                      {srv.description && (
                        <p className="text-xs text-neutral-400 mt-0.5">{srv.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-2">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{srv.duration_minutes} min</span>
                      </div>
                    </div>
                    <div className="text-right pl-3">
                      <span className="text-base font-bold text-amber-400 block">
                        {formatCurrency(srv.price)}
                      </span>
                    </div>
                  </button>
                );
              })}

              {services.length === 0 && (
                <div className="text-center py-8 text-neutral-500 text-sm">
                  Nenhum serviço disponível no momento.
                </div>
              )}
            </div>

            {selectedService && (
              <button
                onClick={() => setStep(2)}
                className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10"
              >
                Avançar para Horário
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ETAPA 2: ESCOLHA DA DATA E HORÁRIO */}
        {step === 2 && selectedService && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Escolha o dia e horário</h2>
                <p className="text-xs text-neutral-400">Serviço: {selectedService.name}</p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs text-neutral-400 hover:text-white underline"
              >
                Alterar
              </button>
            </div>

            {/* Carrossel de Dias */}
            <div>
              <label className="text-xs font-medium text-neutral-400 mb-2 block flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                Selecione o Dia
              </label>
              <div className="grid grid-cols-4 gap-2">
                {availableDays.map((day) => {
                  const isSelected = selectedDate ? isSameDay(selectedDate, day) : false;
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? "bg-amber-500 text-black border-amber-400 font-bold shadow-md shadow-amber-500/20"
                          : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-semibold">
                        {format(day, "EEE", { locale: ptBR })}
                      </span>
                      <span className="text-base font-bold leading-tight mt-0.5">
                        {format(day, "dd")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid de Horários */}
            <div>
              <label className="text-xs font-medium text-neutral-400 mb-2 block flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Horários Livres
              </label>

              {loadingSlots ? (
                <div className="py-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                  Calculando horários...
                </div>
              ) : availableSlots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                          isSelected
                            ? "bg-amber-500 text-black border-amber-400 font-bold shadow-md shadow-amber-500/20"
                            : "bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-neutral-700 hover:bg-neutral-800/80"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-neutral-500 bg-neutral-900/50 rounded-xl border border-neutral-800/60 p-4">
                  Nenhum horário livre para esta data. Escolha outro dia acima.
                </div>
              )}
            </div>

            {selectedSlot && (
              <button
                onClick={() => setStep(3)}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10"
              >
                Avançar para Seus Dados
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ETAPA 3: DADOS DO CLIENTE */}
        {step === 3 && selectedService && selectedSlot && (
          <form onSubmit={handleBooking} className="space-y-4 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-semibold text-white">Seus dados</h2>
              <p className="text-xs text-neutral-400">
                Preencha para confirmarmos seu agendamento
              </p>
            </div>

            {/* Resumo do que foi escolhido */}
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-300">
                <span>Serviço:</span>
                <span className="font-semibold text-white">{selectedService.name}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Data & Horário:</span>
                <span className="font-semibold text-amber-400">
                  {selectedDate ? format(selectedDate, "dd/MM", { locale: ptBR }) : ""} às {selectedSlot}
                </span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Valor:</span>
                <span className="font-bold text-white">{formatCurrency(selectedService.price)}</span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-500" />
                  Seu Nome Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-500" />
                  WhatsApp / Celular
                </label>
                <input
                  type="tel"
                  required
                  placeholder="(00) 00000-0000"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(formatPhoneMask(e.target.value))}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 py-3 px-3 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-300"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-2/3 bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
              >
                {submitting ? "Finalizando..." : "Concluir Agendamento"}
              </button>
            </div>
          </form>
        )}

        {/* ETAPA 4: SUCESSO & CONFIRMAÇÃO NO WHATSAPP */}
        {step === 4 && createdAppointment && selectedService && (
          <div className="text-center space-y-5 animate-in zoom-in-95 duration-300 pt-2">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Horário Reservado!</h2>
              <p className="text-xs text-neutral-400 mt-1">
                Seu agendamento foi registrado com sucesso em nosso sistema.
              </p>
            </div>

            <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-2xl text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-400">Cliente:</span>
                <span className="font-semibold text-white">{createdAppointment.client_name}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-400">Serviço:</span>
                <span className="font-semibold text-white">{selectedService.name}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-400">Data e Horário:</span>
                <span className="font-semibold text-amber-400">
                  {format(new Date(createdAppointment.start_time), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-neutral-400">Valor Estimado:</span>
                <span className="font-bold text-emerald-400">
                  {formatCurrency(selectedService.price)}
                </span>
              </div>
            </div>

            {/* BOTÃO PRINCIPAL: CONFIRMAR NO WHATSAPP */}
            <div className="space-y-3 pt-2">
              <a
                href={getWhatsAppConfirmationLink(
                  shopPhone,
                  createdAppointment.client_name || "Cliente",
                  selectedService.name,
                  new Date(createdAppointment.start_time),
                  shopName
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-600/20 text-sm"
              >
                <MessageCircle className="w-5 h-5" />
                Confirmar no WhatsApp do Barbeiro
              </a>

              <p className="text-[11px] text-neutral-500 leading-tight">
                Clique no botão verde acima para enviar o resumo diretamente ao barbeiro e garantir o atendimento!
              </p>
            </div>

            <button
              onClick={() => {
                setStep(1);
                setSelectedService(null);
                setSelectedSlot(null);
                setCreatedAppointment(null);
              }}
              className="mt-4 text-xs text-neutral-400 hover:text-white underline py-2"
            >
              Fazer outro agendamento
            </button>
          </div>
        )}
      </div>

      {/* Rodapé Minimalista */}
      <footer className="text-center py-4 border-t border-neutral-900 mt-6 text-[11px] text-neutral-600">
        <p>© {new Date().getFullYear()} {shopName} • Agendamento inteligente</p>
      </footer>
    </main>
  );
}
