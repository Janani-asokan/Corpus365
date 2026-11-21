"use client";

import { Printer } from "lucide-react";
import { Button } from "./button";

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> Print / save PDF
    </Button>
  );
}
