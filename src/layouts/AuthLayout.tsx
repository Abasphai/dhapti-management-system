import { Link, Outlet } from "react-router-dom";
import { GraduationCap } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthLayoutProps {
  portalName: string;
  subtitle?: string;
}

export function AuthLayout({ portalName, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold">Dhapti</p>
            <p className="text-sm text-primary-foreground/70">
              Dhapti University
            </p>
          </div>
        </div>

        <div>
          <h1 className="mb-4 text-3xl font-bold">{portalName}</h1>
          <p className="text-primary-foreground/80">
            {subtitle ??
              "Access your academic resources, manage courses, and stay connected with the Dhapti community."}
          </p>
        </div>

        <p className="text-sm text-primary-foreground/60">
          &copy; {new Date().getFullYear()} Dhapti University
        </p>
      </div>

      <div className="flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-6 w-6 text-secondary" />
          </div>
          <span className="font-bold text-primary">Dhapti</span>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{portalName}</CardTitle>
            <CardDescription>Sign in to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Outlet />
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/" className="text-secondary hover:underline">
                Back to main website
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
