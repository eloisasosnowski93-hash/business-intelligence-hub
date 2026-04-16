import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle, Mail, User } from "lucide-react";
import { toast } from "sonner";

const AREAS_LAB = [
  { key: "portaria_145_2022", label: "Portaria 145/2022 — Componentes Automotivos", sugestoes: ["Eloisa"] },
  { key: "endotoxina_esterilidade", label: "Endotoxina & Esterilidade", sugestoes: ["Kevin"] },
  { key: "mri_iso10993", label: "MRI & ISO 10993/18", sugestoes: ["Ana Beatriz", "Kevin"] },
];

const AREAS_OCP = [
  { key: "portaria_384_2020", label: "Portaria 384/2020 — Equip. Vigilância Sanitária", sugestoes: ["Ana Carolina"] },
  { key: "portaria_145_2022_ocp", label: "Portaria 145/2022 — Automotivo (OCP)", sugestoes: ["Eloisa"] },
  { key: "portaria_071_2022", label: "Portaria 071/2022", sugestoes: ["Ana Carolina", "Eloisa"] },
  { key: "portaria_501_2021", label: "Portaria 501/2021 — Rodas", sugestoes: ["Eloisa"] },
];

type Config = { responsavel: string; email: string };

const DEFAULTS: Record<string, Config> = {
  portaria_145_2022: { responsavel: "Eloisa", email: "" },
  endotoxina_esterilidade: { responsavel: "Kevin", email: "" },
  mri_iso10993: { responsavel: "Ana Beatriz", email: "" },
  portaria_384_2020: { responsavel: "Ana Carolina", email: "" },
  portaria_145_2022_ocp: { responsavel: "Eloisa", email: "" },
  portaria_071_2022: { responsavel: "", email: "" },
  portaria_501_2021: { responsavel: "", email: "" },
};

export default function Configuracoes() {
  const [saved, setSaved] = useState(false);
  const [configs, setConfigs] = useState<Record<string, Config>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("area_config") || "{}");
      return Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, stored[k] || DEFAULTS[k]]));
    } catch { return { ...DEFAULTS }; }
  });
  const [notifEmail, setNotifEmail] = useState(() => localStorage.getItem("notif_email") || "");
  const [notifDias, setNotifDias] = useState(() => localStorage.getItem("notif_dias") || "90");

  const update = (key: string, field: keyof Config, value: string) => {
    setConfigs(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem("area_config", JSON.stringify(configs));
    localStorage.setItem("notif_email", notifEmail);
    localStorage.setItem("notif_dias", notifDias);
    setSaved(true);
    toast.success("Configurações salvas!");
    setTimeout(() => setSaved(false), 3000);
  };

  const renderArea = (area: typeof AREAS_LAB[0]) => (
    <div key={area.key} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-muted/40 rounded-lg">
      <div>
        <p className="text-sm font-medium">{area.label}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {area.sugestoes.map(s => (
            <button key={s} onClick={() => update(area.key, "responsavel", s)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Responsável</label>
        <Input value={configs[area.key]?.responsavel || ""} placeholder="Nome"
          onChange={e => update(area.key, "responsavel", e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">E-mail</label>
        <Input value={configs[area.key]?.email || ""} placeholder="email@scitec.com.br"
          onChange={e => update(area.key, "email", e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Responsáveis por área e notificações</p>
        </div>
        <Button onClick={handleSave} className="gap-2">
          {saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Salvo!" : "Salvar"}
        </Button>
      </div>

      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4" /> Notificações de Vencimento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">E-mail para alertas</label>
            <Input placeholder="email@scitec.com.br" value={notifEmail} onChange={e => setNotifEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Alertar com antecedência de</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notifDias} onChange={e => setNotifDias(e.target.value)}>
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
              <option value="90">90 dias (recomendado)</option>
              <option value="180">180 dias</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          <Badge className="bg-red-900 text-white text-xs">Laboratório</Badge>
          Responsáveis
        </h3>
        <div className="space-y-3">{AREAS_LAB.map(renderArea)}</div>
      </div>

      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          <Badge className="bg-blue-900 text-white text-xs">OCP</Badge>
          Responsáveis por Portaria
        </h3>
        <div className="space-y-3">{AREAS_OCP.map(renderArea)}</div>
      </div>
    </div>
  );
}
