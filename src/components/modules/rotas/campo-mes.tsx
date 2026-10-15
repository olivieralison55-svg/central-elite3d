"use client";

import Select from "@/components/ui/select";
import { dpLabel, hojeSP } from "@/lib/datas";

// O campo de mês (monthField, index.html:1041; AD-008): dois Select do DS, mês e ano, com valor
// "AAAA-MM". Sem valor, vale o mês corrente, lido na hora. `type="month"` ficou de fora: só o
// Chromium de desktop e os navegadores mobile têm o controle, os outros caem em texto livre.

const MESES = Array.from({ length: 12 }, (_, i) => {
  const mes = String(i + 1).padStart(2, "0");
  return { value: mes, label: dpLabel(`2000-${mes}`, "month").split("/")[0] };
});

export default function CampoMes({ id, value, onChange, anos }: { id: string; value: string; onChange(mes: string): void; anos: readonly number[] }) {
  const [ano, mes] = (value || hojeSP().slice(0, 7)).split("-");
  return (
    <div className="flex gap-2">
      <div className="w-28">
        <label htmlFor={`${id}-mes`} className="sr-only">
          Mês
        </label>
        <Select id={`${id}-mes`} options={MESES} value={mes} onChange={(novo) => onChange(`${ano}-${novo}`)} />
      </div>
      <div className="w-28">
        <label htmlFor={`${id}-ano`} className="sr-only">
          Ano
        </label>
        <Select id={`${id}-ano`} options={anos.map((a) => ({ value: String(a), label: String(a) }))} value={ano} onChange={(novo) => onChange(`${novo}-${mes}`)} />
      </div>
    </div>
  );
}
