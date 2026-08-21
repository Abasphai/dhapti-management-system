import { Outlet } from "react-router-dom";

import { Footer, Navbar } from "@/components/common";

export function MainLayout() {
  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden">
      <Navbar />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
