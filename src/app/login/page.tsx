"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, setupFirstAdmin, checkSystemInitialized } from "@/app/auth-actions"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import Link from "next/link";

// Define the expected response type from your server actions
type AuthResponse = {
  error?: string;
  success?: boolean;
};

export default function LoginPage() {
  const [isSetupMode, setIsSetupMode] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkSystemInitialized().then((initialized) => {
        setIsSetupMode(!initialized);
    });
  }, []);

  async function handleSubmit(formData: FormData) {
    setError("");
    setIsLoading(true); // Optional: Add a loading state to prevent double-clicks
    
    try {
      const action = isSetupMode ? setupFirstAdmin : login;
      // Properly type the response so we don't need the `(res as any)` hack
      const res = (await action(formData)) as AuthResponse;

      if (res?.error) {
        setError(res.error);
        setIsLoading(false);
      } else if (res?.success) {
        // Force the router to refresh the middleware state, then push
        router.refresh();
        router.push("/admin"); 
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  if (isSetupMode === null) {
      return (
          <div className="flex min-h-screen items-center justify-center bg-muted/40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
             {isSetupMode && <ShieldCheck className="h-6 w-6 text-primary" />}
             {isSetupMode ? "Setup Owner Account" : "Admin Login"}
          </CardTitle>
          <CardDescription>
            {isSetupMode 
                ? "Welcome! Create the first administrator account to get started." 
                : "Enter your credentials to access the dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                  key={isSetupMode ? "setup-user" : "login-user"}
                  id="username" 
                  name="username" 
                  type="text" 
                  required 
                  placeholder={isSetupMode ? "e.g. admin" : "Username"}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  disabled={isLoading}
              />
            </div>
            
            {isSetupMode && (
                <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                        key="setup-email"
                        id="email" 
                        name="email" 
                        type="email" 
                        required 
                        placeholder="admin@example.com" 
                        autoComplete="email"
                        disabled={isLoading}
                    />
                </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                  key={isSetupMode ? "setup-pass" : "login-pass"}
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                  autoComplete={isSetupMode ? "new-password" : "current-password"}
                  disabled={isLoading}
              />
            </div>
            
            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                    <AlertCircle className="h-4 w-4 shrink-0" /> 
                    <span>{error}</span>
                </div>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSetupMode ? "Create & Login" : "Sign in now"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t p-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                <ArrowLeft className="h-3 w-3" /> Back to Home
            </Link>
        </CardFooter>
      </Card>
    </div>
  );
}