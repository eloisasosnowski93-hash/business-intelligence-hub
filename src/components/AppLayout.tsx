import { useUnit } from "@/contexts/UnitContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { unit } = useUnit();

  return (
    <div data-unit={unit} className="min-h-screen bg-background">
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger className="h-7 w-7" />
          </div>
          <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </div>
  );
}
