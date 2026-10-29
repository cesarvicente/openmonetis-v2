import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { OpenMonetisLogo } from "@/components/openmonetis-logo";
import { PublicOnlyRoute } from "./public-only-route";

export function AuthPageLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PublicOnlyRoute>
      <main className="relative isolate flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden bg-background px-4 py-16">
        <div
          aria-hidden="true"
          className="atmospheric-wash absolute top-1/2 left-1/2 -z-10 size-[min(42rem,90vw)] -translate-x-1/2 -translate-y-1/2 opacity-55"
        />
        <Link to="/">
          <OpenMonetisLogo />
        </Link>
        <section className="w-full max-w-md rounded-card border border-border bg-background/85 p-6 backdrop-blur-md sm:p-8">
          <h1 className="mt-3 font-heading text-4xl font-normal">{title}</h1>
          <p className="mt-3 text-muted-foreground text-sm">{description}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-6 text-center text-muted-foreground text-sm">
            Lembrou a senha?{" "}
            <Link className="font-medium text-brand-strong hover:underline" to="/">
              Entrar
            </Link>
          </p>
        </section>
      </main>
    </PublicOnlyRoute>
  );
}
