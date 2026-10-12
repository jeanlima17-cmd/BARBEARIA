import { format, parse, isBefore, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Appointment, BlockedTime, BusinessHour } from "@/types/database";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function getWhatsAppConfirmationLink(
  barberPhone: string,
  clientName: string,
  serviceName: string,
  startTime: Date,
  barbershopName: string = "Barbearia"
): string {
  const cleanBarberPhone = cleanPhone(barberPhone);
  const dataFormatada = format(startTime, "EEEE, dd 'de' MMMM 'às' HH:mm", {
    locale: ptBR,
  });

  const message = `Olá! Gostaria de confirmar meu agendamento na *${barbershopName}*:\n\n` +
    `👤 *Cliente:* ${clientName}\n` +
    `💈 *Serviço:* ${serviceName}\n` +
    `📅 *Data/Horário:* ${dataFormatada}\n\n` +
    `Muito obrigado! Aguardo seu retorno.`;

  return `https://wa.me/${cleanBarberPhone}?text=${encodeURIComponent(message)}`;
}

export function getWhatsAppReminderLink(
  clientPhone: string,
  clientName: string,
  serviceName: string,
  startTime: Date,
  barbershopName: string = "Barbearia"
): string {
  const cleanClientPhone = cleanPhone(clientPhone);
  const dataFormatada = format(startTime, "dd/MM 'às' HH:mm", {
    locale: ptBR,
  });

  const message = `Olá, *${clientName}*! 👋\n` +
    `Passando para lembrar do seu horário de *${serviceName}* na *${barbershopName}*:\n\n` +
    `📅 *Hoje às ${dataFormatada}*\n\n` +
    `Nos vemos em breve! Qualquer imprevisto avise aqui com antecedência.`;

  return `https://wa.me/${cleanClientPhone}?text=${encodeURIComponent(message)}`;
}

interface GenerateSlotsParams {
  date: Date;
  businessHour: BusinessHour | null;
  serviceDurationMinutes: number;
  existingAppointments: Appointment[];
  blockedTimes: BlockedTime[];
}

export function generateAvailableSlots({
  date,
  businessHour,
  serviceDurationMinutes,
  existingAppointments,
  blockedTimes,
}: GenerateSlotsParams): string[] {
  if (!businessHour || !businessHour.is_open) {
    return [];
  }

  const dateStr = format(date, "yyyy-MM-dd");
  const openTime = parse(`${dateStr} ${businessHour.open_time}`, "yyyy-MM-dd HH:mm:ss", date);
  const closeTime = parse(`${dateStr} ${businessHour.close_time}`, "yyyy-MM-dd HH:mm:ss", date);

  let breakStartTime: Date | null = null;
  let breakEndTime: Date | null = null;

  if (businessHour.break_start && businessHour.break_end) {
    breakStartTime = parse(`${dateStr} ${businessHour.break_start}`, "yyyy-MM-dd HH:mm:ss", date);
    breakEndTime = parse(`${dateStr} ${businessHour.break_end}`, "yyyy-MM-dd HH:mm:ss", date);
  }

  const now = new Date();
  const slots: string[] = [];
  let currentSlot = openTime;

  // Intervalos de 30 minutos por slot padrão
  const stepMinutes = 30;

  while (isBefore(addMinutes(currentSlot, serviceDurationMinutes), closeTime) || 
         currentSlot.getTime() + serviceDurationMinutes * 60000 === closeTime.getTime()) {
    const slotEnd = addMinutes(currentSlot, serviceDurationMinutes);

    // 1. Não pode estar no passado
    if (isBefore(currentSlot, now)) {
      currentSlot = addMinutes(currentSlot, stepMinutes);
      continue;
    }

    // 2. Não pode colidir com horário de almoço
    if (breakStartTime && breakEndTime) {
      if (
        (currentSlot >= breakStartTime && currentSlot < breakEndTime) ||
        (slotEnd > breakStartTime && slotEnd <= breakEndTime) ||
        (currentSlot <= breakStartTime && slotEnd >= breakEndTime)
      ) {
        currentSlot = addMinutes(currentSlot, stepMinutes);
        continue;
      }
    }

    // 3. Não pode colidir com agendamentos existentes
    const collidesWithAppointment = existingAppointments.some((appt) => {
      if (appt.status === "cancelled") return false;
      const apptStart = new Date(appt.start_time);
      const apptEnd = new Date(appt.end_time);

      return (
        (currentSlot >= apptStart && currentSlot < apptEnd) ||
        (slotEnd > apptStart && slotEnd <= apptEnd) ||
        (currentSlot <= apptStart && slotEnd >= apptEnd)
      );
    });

    if (collidesWithAppointment) {
      currentSlot = addMinutes(currentSlot, stepMinutes);
      continue;
    }

    // 4. Não pode colidir com bloqueios manuais
    const collidesWithBlock = blockedTimes.some((block) => {
      const blockStart = new Date(block.start_time);
      const blockEnd = new Date(block.end_time);

      return (
        (currentSlot >= blockStart && currentSlot < blockEnd) ||
        (slotEnd > blockStart && slotEnd <= blockEnd) ||
        (currentSlot <= blockStart && slotEnd >= blockEnd)
      );
    });

    if (collidesWithBlock) {
      currentSlot = addMinutes(currentSlot, stepMinutes);
      continue;
    }

    slots.push(format(currentSlot, "HH:mm"));
    currentSlot = addMinutes(currentSlot, stepMinutes);
  }

  return slots;
}
