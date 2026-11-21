import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-3xl font-semibold">We couldn’t find that page</h1>
      <p className="mt-2 text-ink-muted">It may have moved, or the link may be mistyped.</p>
      <div className="mt-6 flex justify-center gap-3">
        <LinkButton href="/">Go home</LinkButton>
        <LinkButton href="/marketplace" variant="secondary">Browse the marketplace</LinkButton>
      </div>
    </div>
  );
}
