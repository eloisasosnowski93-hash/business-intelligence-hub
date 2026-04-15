import { useUnit } from "@/contexts/UnitContext";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Search, Users, FileBarChart, Zap, FlaskConical, ShieldCheck, Beaker } from "lucide-react";

const labItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Prospecção INMETRO", url: "/prospeccao", icon: Search },
  { title: "Endotoxina & Esterilidade", url: "/endotoxina", icon: FlaskConical },
  { title: "Enriquecimento", url: "/enriquecimento", icon: Zap },
  { title: "CRM Leads", url: "/crm", icon: Users },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
];

const ocpItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Prospecção Portarias", url: "/prospeccao", icon: Search },
  { title: "Certificação", url: "/certificacao", icon: ShieldCheck },
  { title: "Enriquecimento", url: "/enriquecimento", icon: Zap },
  { title: "CRM Leads", url: "/crm", icon: Users },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
];

export function AppSidebar() {
  const { unit, setUnit, unitLabel } = useUnit();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const items = unit === "lab" ? labItems : ocpItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo per unit */}
        <div className="p-4 pb-2">
          {!collapsed ? (
            <div className="animate-fade-in flex items-center gap-3">
              <img
                src={unit === "lab" ? "/images/scitec-logo.png" : "/images/logo-ocp.png"}
                alt={unit === "lab" ? "Scitec Laboratório" : "OCP Certificadora"}
                className="h-10 w-10 object-contain rounded"
              />
              <div>
                <h1 className="font-heading text-base font-bold text-sidebar-foreground tracking-tight">
                  {unit === "lab" ? "SCITEC" : "OCP"}
                </h1>
                <p className="text-[10px] text-sidebar-foreground/60">{unitLabel}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <img
                src={unit === "lab" ? "/images/scitec-logo.png" : "/images/logo-ocp.png"}
                alt={unitLabel}
                className="h-8 w-8 object-contain rounded"
              />
            </div>
          )}
        </div>

        {/* Unit Switcher */}
        {!collapsed && (
          <div className="px-4 pb-3">
            <div className="flex gap-1 bg-sidebar-accent rounded-lg p-1">
              <button
                onClick={() => setUnit("lab")}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  unit === "lab"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                }`}
              >
                <Beaker className="h-3 w-3" />
                Lab
              </button>
              <button
                onClick={() => setUnit("ocp")}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  unit === "ocp"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                }`}
              >
                <ShieldCheck className="h-3 w-3" />
                OCP
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
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
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
            <p className="text-[10px] text-sidebar-foreground/40 font-body">
              {unit === "lab" ? "Scitec Certificações — Laboratório" : "Scitec Certificações — OCP"}
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
