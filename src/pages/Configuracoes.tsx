import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, CheckCircle, XCircle, ExternalLink, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_CONFIGS = {
  SERPER_API_KEY: {
    label: "Serper.dev — Google Search API",
    description: "Busca o site oficial da empresa no Google.",
    freePlan: "2.500 buscas/mês grátis",
    signupUrl: "https://serper.dev",
    docsUrl: "https://serper.dev/api-reference",
    placeholder: "sua_chave_serper...",
  },
  HUNTER_API_KEY: {
    label: "Hunter.io — Email Finder",
    description: "Encontra e valida emails corporativos por domínio da empresa.",
    freePlan: "25 buscas/mês grátis",
    signupUrl: "https://hunter.io/users/sign_up",
    docsUrl: "https://hunter.io/api-documentation",
    placeholder: "sua_chave_hunter...",
  },
  APOLLO_API_KEY: {
    label: "Apollo.io — B2B Contact Search",
    description: "Encontra decisores por cargo (Qualidade, Regulatório, P&D, Compras).",
    freePlan: "10.000 créditos/mês grátis",
    signupUrl: "https://app.apollo.io/#/sign-up",
    docsUrl: "https://apolloio.github.io/apollo-api-docs",
    placeholder: "sua_chave_apollo...",
  },
  BACKEND_URL: {
    label: "URL do Backend (Railway)",
    description: "URL da API backend que processa as buscas.",
    freePlan: "Gratuito até 500 horas/mês",
    signupUrl: "https://railway.app",
    docsUrl: "https://docs.railway.app",
    placeholder: "https://seu-backend.railway.app",
  },
} as const;

type ApiKey = keyof typeof API_CONFIGS;

export default function Configuracoes() {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loaded: Record<string, string> = {};
    (Object.keys(API_CONFIGS) as ApiKey[]).forEach((k) => {
      loaded[k] = localStorage.getItem(k) || "";
    });
    setValues(loaded);
  }, []);

  const handleSave = (key: string) => {
    const val = values[key]?.trim();
    if (!val) {
      toast({ title: "Campo vazio", description: "Digite a chave antes de salvar.", variant: "destructive" });
      return;
    }
    localStorage.setItem(key, val);
    setSaved((prev) => ({ ...prev, [key]: true }));
    toast({ title: "Chave salva!", description: `${API_CONFIGS[key as ApiKey].label} configurada.` });
    setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 3000);
  };

  const handleClear = (key: string) => {
    localStorage.removeItem(key);
    setValues((prev) => ({ ...prev, [key]: "" }));
    toast({ title: "Chave removida" });
  };

  const isConfigured = (key: string) => !!localStorage.getItem(key);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Configure as chaves de API para enriquecimento automático de leads.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status das Integrações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {(Object.entries(API_CONFIGS) as [ApiKey, typeof API_CONFIGS[ApiKey]][]).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                {isConfigured(key)
                  ? <CheckCircle className="h-4 w-4 text-green-500" />
                  : <XCircle className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{cfg.label.split(" — ")[0]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {(Object.entries(API_CONFIGS) as [ApiKey, typeof API_CONFIGS[ApiKey]][]).map(([key, cfg]) => (
          <Card key={key} className={isConfigured(key) ? "border-green-500/30" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-base">{cfg.label}</CardTitle>
                    {isConfigured(key) && (
                      <Badge variant="outline" className="text-green-600 border-green-500 text-[10px]">Ativa</Badge>
                    )}
                  </div>
                  <CardDescription>{cfg.description}</CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">{cfg.freePlan}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={key} className="text-xs text-muted-foreground">Chave de API</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id={key}
                      type={visible[key] ? "text" : "password"}
                      placeholder={cfg.placeholder}
                      value={values[key] || ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="pr-10 font-mono text-sm"
                    />
                    <button type="button"
                      onClick={() => setVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {visible[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button size="sm" onClick={() => handleSave(key)} variant={saved[key] ? "outline" : "default"} className="gap-1.5">
                    {saved[key] ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Save className="h-3.5 w-3.5" />}
                    {saved[key] ? "Salvo" : "Salvar"}
                  </Button>
                  {isConfigured(key) && (
                    <Button size="sm" variant="ghost" onClick={() => handleClear(key)} className="text-destructive hover:text-destructive">
                      Remover
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <a href={cfg.signupUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Criar conta gratuita
                </a>
                <a href={cfg.docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                  <ExternalLink className="h-3 w-3" /> Documentação
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Como funciona:</strong> As chaves são salvas no navegador (localStorage).
            Para produção, configure as variáveis de ambiente diretamente no painel do Railway.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
