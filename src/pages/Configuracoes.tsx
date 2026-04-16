import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, User, Mail, Save, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const AREAS_LAB = [
  { key: "portaria_145_2022", label: "Portaria 145/2022 — Componentes Automotivos", defaultResp: "Eloisa", defaultEmail: "" },
  { key: "endotoxina_esterilidade", label: "Endotoxina & Esterilidade", defaultResp: "Kevin", defaultEmail: "" },
  { key: "mri_iso10993", label: "MRI & ISO 10993/18", defaultResp: "Ana Beatriz", defaultEmail: "" },
];

const AREAS_OCP = [
  { key: "portaria_384_2020", label: "Portaria 384/2020 — Equip. Vigilância Sanitária", defaultResp: "Ana Carolina", defaultEmail: "" },
  { key: "portaria_145_2022_ocp", label: "Portaria 145/2022 — Automotivo (OCP)", defaultResp: "Eloisa", defaultEmail: "" },
  { key: "portaria_071_2022", label: "Portaria 071/2022", defaultResp: "", defaultEmail: "" },
  { key: "portaria_501_2021", label: "Portaria 501/2021 — Rodas", defaultResp: "", defaultEmail: "" },
];

type Config = { responsavel: string; email: string };

function loadConfig(): Record<string, Config> {
  try { return JSON.parse(localStorage.getItem("area_config") || "{}"); } catch { return {}; }
}

export default function Configuracoes() {
  const [saved, setSaved] = useState(false);
  const [configs, setConfigs] = useState<Record<string, Config>>(() => {
    const stored = loadConfig();
    const all = [...AREAS_LAB, ...AREAS_OCP];
    return Object.fromEntries(all.map(a => [a.key, stored[a.key] || { responsavel: a.defaultResp, email: a.defaultEmail }]));
  });
  const [notifEmail, setNotifEmail] = useState(() => localStorage.getItem("notif_email") || "");
  const [notifDias, setNotifDias] = useState(() => localStorage.getItem("notif_dias") || "90");

  const update = (key: string, field: "responsavel" | "email", value: string) => {
    setConfigs(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem("area_config", JSON.stringify(configs));
    localStorage.setItem("notif_email", notifEmail);
    localStorage.setItem("notif_dias", notifDias);
    setSaved(true);
    toast.success("Configurações salvas com sucesso!");
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina responsáveis por área e configurações de notificação</p>
        </div>
        <Button onClick={handleSave} className="gap-2">
          {saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Salvo!" : "Salvar Configurações"}
        </Button>
      </div>

      {/* Notificações */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4" /> Notificações de Vencimento de Certificados
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">E-mail para notificações</label>
            <Input placeholder="email@scitec.com.br" value={notifEmail} onChange={e => setNotifEmail(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-1">Receberá alertas de certificados próximos do vencimento</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Alertar com quantos dias de antecedência</label>
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

      {/* Laboratório */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          <Badge className="text-xs bg-red-900 text-white">Laboratório</Badge>
          Responsáveis por Área
        </h3>
        <div className="space-y-4">
          {AREAS_LAB.map(area => (
            <div key={area.key} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg">
              <div className="md:col-span-1">
                <p className="text-sm font-medium text-foreground">{area.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Área: {area.key}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Responsável</label>
                <Input placeholder="Nome do responsável" value={configs[area.key]?.responsavel || ""}
                  onChange={e => update(area.key, "responsavel", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">E-mail do responsável</label>
                <Input placeholder="responsavel@scitec.com.br" value={configs[area.key]?.email || ""}
                  onChange={e => update(area.key, "email", e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OCP */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          <Badge className="text-xs bg-blue-900 text-white">OCP</Badge>
          Responsáveis por Portaria
        </h3>
        <div className="space-y-4">
          {AREAS_OCP.map(area => (
            <div key={area.key} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg">
              <div className="md:col-span-1">
                <p className="text-sm font-medium text-foreground">{area.label}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Responsável</label>
                <Input placeholder="Nome do responsável" value={configs[area.key]?.responsavel || ""}
                  onChange={e => update(area.key, "responsavel", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">E-mail do responsável</label>
                <Input placeholder="responsavel@scitec.com.br" value={configs[area.key]?.email || ""}
                  onChange={e => update(area.key, "email", e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
