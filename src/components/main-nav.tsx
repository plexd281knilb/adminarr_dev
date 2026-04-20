"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
    LayoutDashboard, 
    Users, 
    Settings, 
    Activity, 
    Layers,
    Trash2 
} from "lucide-react";

export function MainNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();

  const LinkItem = ({ href, icon: Icon, label, exact = false }: any) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <nav className={cn("flex items-center space-x-4 lg:space-x-6", className)} {...props}>
      <LinkItem href="/admin" icon={LayoutDashboard} label="Dashboard" exact />
      <LinkItem href="/monitoring" icon={Activity} label="Infrastructure" />
      <LinkItem href="/apps" icon={Layers} label="Apps" />
      <LinkItem href="/cleanup" icon={Trash2} label="Optimizer" />
      <LinkItem href="/users" icon={Users} label="Users" />
      <LinkItem href="/settings" icon={Settings} label="Settings" />
    </nav>
  );
}