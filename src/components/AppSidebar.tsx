<<<<<<< HEAD
=======
import { useUnit } from "@/contexts/UnitContext";
import { NavLink } from "@/components/NavLink";
>>>>>>> 36bb10aa969731b9743f218595e129b278f9f98e
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
<<<<<<< HEAD
import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, Search, ShieldCheck, FileBarChart, Settings } from "lucide-react";

const ocpItems = [
  { title: "Dashboard",        url: "/",              icon: LayoutDashboard },
  { title: "Prospecção OCP",   url: "/prospeccao",    icon: Search },
  { title: "Certificação OCP", url: "/certificacao",  icon: ShieldCheck },
  { title: "Relatórios",       url: "/relatorios",    icon: FileBarChart },
  { title: "Configurações",    url: "/configuracoes", icon: Settings },
=======
import { LayoutDashboard, Search, FileBarChart, FlaskConical, ShieldCheck, Beaker, Settings } from "lucide-react";

const labItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Prospecção", url: "/prospeccao", icon: Search },
  { title: "Endotoxina & Esterilidade", url: "/endotoxina", icon: FlaskConical },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const ocpItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Prospecção", url: "/prospeccao", icon: Search },
  { title: "Certificação", url: "/certificacao", icon: ShieldCheck },
  { title: "Relatórios", url: "/relatorios", icon: FileBarChart },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
>>>>>>> 36bb10aa969731b9743f218595e129b278f9f98e
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 pb-2">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm bg-blue-900">OCP</div>
              <div>
                <h1 className="font-heading text-sm font-bold text-sidebar-foreground">SCITEC OCP</h1>
                <p className="text-[10px] text-sidebar-foreground/60">Certificadora OCP</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs bg-blue-900">OCP</div>
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ocpItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
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
            <p className="text-[10px] text-sidebar-foreground/40">Scitec Inspeções e Certificações — OCP</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
