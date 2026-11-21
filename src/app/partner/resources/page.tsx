import type { Metadata } from "next";
import { BookOpen, CirclePlay, Download, Headset, Megaphone } from "lucide-react";
import { config } from "@/lib/config";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = { title: "Training & resources" };

const TRAINING = [
  { title: "Corpus365 in 15 minutes: what you sell and why", duration: "15 min", track: "Start here" },
  { title: "Demoing Fitness Center Management to a gym owner", duration: "12 min", track: "Apps" },
  { title: "Demoing School ERP to a principal", duration: "14 min", track: "Apps" },
  { title: "Installing and pairing a biometric attendance device", duration: "9 min", track: "Hardware" },
  { title: "Setting up barcode label printers", duration: "6 min", track: "Hardware" },
  { title: "Handling common objections honestly", duration: "8 min", track: "Selling" },
];

const KIT = [
  { title: "Fitness Center Management brochure", format: "PDF" },
  { title: "School ERP one-pager", format: "PDF" },
  { title: "Hardware price list (partner)", format: "PDF" },
  { title: "WhatsApp message templates", format: "TXT" },
];

export default function ResourcesPage() {
  return (
    <>
      <PageHeader title="Training & resources" description="Everything you need to demo, install and support Corpus365 well." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <BookOpen className="size-4 text-brand" aria-hidden />
            <h2 className="font-semibold">Partner academy</h2>
          </div>
          <ul className="divide-y divide-line">
            {TRAINING.map((module) => (
              <li key={module.title} className="flex items-center gap-4 px-5 py-4">
                <CirclePlay className="size-8 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
                <div className="flex-1">
                  <p className="font-medium">{module.title}</p>
                  <p className="text-sm text-ink-muted">{module.duration}</p>
                </div>
                <Badge>{module.track}</Badge>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-muted">Videos are published in the monthly training session schedule. Device certification follows the hardware modules.</p>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Megaphone className="size-4 text-brand" aria-hidden />Sales kit</h2>
            <ul className="mt-3 space-y-2">
              {KIT.map((item) => (
                <li key={item.title} className="flex items-center justify-between gap-2 text-sm">
                  <span>{item.title}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-muted"><Download className="size-3.5" aria-hidden />{item.format}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">Co-branded brochures unlock at Silver.</p>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Headset className="size-4 text-brand" aria-hidden />Partner helpline</h2>
            <p className="mt-2 text-sm text-ink-muted">Stuck on a demo or an install? We’re here to help, Monday to Saturday.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`mailto:${config.supportEmail}?subject=Live%20client%20demo%20request`} className={buttonStyles({ variant: "accent", size: "sm" })}>Book a live client demo</a>
              <a href={`mailto:${config.supportEmail}`} className={buttonStyles({ variant: "secondary", size: "sm" })}>Email support</a>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
