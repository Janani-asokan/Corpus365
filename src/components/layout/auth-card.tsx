import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function AuthCard({ title, description, children, footer, wide }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div className="container-page py-12 sm:py-16">
      <Card className={`mx-auto p-6 sm:p-8 ${wide ? "max-w-xl" : "max-w-md"}`}>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1.5 text-ink-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <div className="mx-auto mt-6 max-w-md text-center text-sm text-ink-muted">{footer}</div>}
    </div>
  );
}
