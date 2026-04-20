"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/auth-actions"; 
import { 
  Users, 
  Settings, 
  Menu,
  X,
  LogOut,
  Shield,
  Trash2,
  DollarSign, // Added for Payments
  LayoutDashboard
} from "lucide-react";

// --- MASTER'S ACTIVE NAVIGATION ---
const navItems = [
  { href: "/admin", icon: Shield, label: "Admin Overview", exact: true },
  { href: "/optimizer", icon: Trash2, label: "Media Optimizer" },
  { href: "/users", icon: Users, label: "User List" },
  { href: "/payments", icon: DollarSign, label: "Payments" },
  { href: "/settings", icon: Settings, label: "System Settings" },
];

export function Sidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className={cn("hidden lg:flex flex-col h-full w-64 border-r bg-sidebar", className)}>
      <div className="flex flex-col h-full py-6 px-4">
        <div className="mb-8 px-2">
          <h2 className="text-2xl font-bold tracking-tighter text-primary italic">Adminarr</h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-70">Master Command</p>
        </div>
        
        <div className="space-y-1.5 flex-1">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <Button variant={active ? "secondary" : "ghost"} className={cn("w-full justify-start gap-3", active && "bg-primary/10 text-primary font-semibold")}>
                  <item.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto border-t border-border/50 pt-4">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-500 hover:bg-red-500/10 hover:text-red-500" 
            onClick={() => logout()}
          >
            <LogOut className="mr-2 h-4 w-4" /> Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MobileSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setIsOpen(false), [pathname]);

  if (!mounted) return null;

  return (
    <>
      <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setIsOpen(true)}>
        <Menu className="h-6 w-6" />
      </Button>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex lg:hidden animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-[280px] bg-sidebar h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h2 className="text-xl font-bold tracking-tight text-primary">Adminarr</h2>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Mobile Terminal</p>
               </div>
               <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <Button variant={active ? "secondary" : "ghost"} className="w-full justify-start gap-3 text-base">
                      <item.icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
            <div className="mt-auto border-t pt-4">
              <Button variant="ghost" className="w-full justify-start text-red-500 text-base" onClick={() => logout()}>
                <LogOut className="mr-3 h-5 w-5" /> Log Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}