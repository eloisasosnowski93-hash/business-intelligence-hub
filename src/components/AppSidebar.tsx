import { useUnit } from "@/contexts/UnitContext";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Search, Users, FileBarChart, Zap, FlaskConical, ShieldCheck, Beaker, Settings, Sparkles } from "lucide-react";

const labItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Prospecção Lab", url: "/prospeccao", icon: Search },
  { title: "Endotoxina & Esterilidade", url: "/endotoxina", icon: FlaskConical },
  { title: "Motor de Busca", url: "/motor-busca", icon: Sparkles },
  { title: "Enriquecimento", url: "/enriquecimento", icon: Zap },
  { title: "CRM Leads", url: "/crm", icon: Users },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const ocpItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Prospecção OCP", url: "/prospeccao", icon: Search },
  { title: "Certificação OCP", url: "/certificacao", icon: ShieldCheck },
  { title: "Motor de Busca", url: "/motor-busca", icon: Sparkles },
  { title: "Enriquecimento", url: "/enriquecimento", icon: Zap },
  { title: "CRM Leads", url: "/crm", icon: Users },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { unit, setUnit, unitLabel } = useUnit();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const items = unit === "lab" ? labItems : ocpItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 pb-2">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm ${unit === "lab" ? "bg-red-900" : "bg-blue-900"}`}>
                {unit === "lab" ? "SL" : "OCP"}
              </div>
              <div>
                <h1 className="font-heading text-sm font-bold text-sidebar-foreground">
                  {unit === "lab" ? "SCITEC Lab" : "SCITEC OCP"}
                </h1>
                <p className="text-[10px] text-sidebar-foreground/60">{unitLabel}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${unit === "lab" ? "bg-red-900" : "bg-blue-900"}`}>
                {unit === "lab" ? "SL" : "OCP"}
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-4 pb-3">
            <div className="flex gap-1 bg-sidebar-accent rounded-lg p-1">
              <button onClick={() => setUnit("lab")}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${unit === "lab" ? "bg-red-900 text-white shadow-sm" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}>
                <Beaker className="h-3 w-3" /> Lab
              </button>
              <button onClick={() => setUnit("ocp")}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${unit === "ocp" ? "bg-blue-900 text-white shadow-sm" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}>
                <ShieldCheck className="h-3 w-3" /> OCP
              </button>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && (
          <div className="p-4 pt-2">
            <p className="text-[10px] text-sidebar-foreground/40">
              {unit === "lab" ? "Scitec Certificações — Laboratório" : "Scitec Inspeções e Certificações — OCP"}
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
