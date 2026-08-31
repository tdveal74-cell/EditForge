"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { downloadText } from "@/lib/download";
import { COLLAB_ENFORCED, COLLAB_ROLES, buildRoleAgreement } from "@/lib/collab";

export default function CollabPage() {
  const [gate, setGate] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setGate(Boolean(d.accessGate)))
      .catch(() => setGate(null));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Board"
        title="Role agreement"
        description="A working-agreement board, not a permissions product. Per-role access is not enforced. Download the agreement as a file. The ship decision has one owner by agreement; the gates below hold by code."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              downloadText("editforge-role-agreement.json", buildRoleAgreement(), "application/json")
            }
          >
            Download agreement
          </Button>
        }
      />

      <Section title="What is enforced">
        {gate === false && (
          <p className="mb-3 rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No access password is set on this deployment, so the app is open. Set{" "}
            <code className="rounded bg-amber-100 px-1">EDITFORGE_ACCESS_PASSWORD</code> and redeploy to close
            it.
          </p>
        )}
        {gate === true && (
          <p className="mb-3 rounded-control border border-border bg-surface-muted/50 px-3 py-2 text-sm text-navy/70">
            The access gate is on for this deployment.
          </p>
        )}

        <ul className="space-y-2">
          {COLLAB_ENFORCED.map((e) => (
            <li
              key={e.what}
              className="flex gap-3 rounded-card border border-border bg-surface-elevated px-4 py-3 shadow-card"
            >
              <span
                aria-hidden
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${e.real ? "bg-navy" : "bg-amber"}`}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy">
                  {e.what}
                  {!e.real && (
                    <span className="ml-2 text-[11px] uppercase tracking-wide text-amber-700">
                      by agreement only
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-navy/60">{e.how}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Roles">
        <div className="grid gap-3 sm:grid-cols-2">
          {COLLAB_ROLES.map((r) => (
            <Card key={r.role} interactive className="p-4">
              <p className="text-sm font-semibold text-navy">{r.role}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.access.map((a) => (
                  <Badge key={a} tone="neutral">
                    {a}
                  </Badge>
                ))}
              </div>
              <p className="mt-2.5 border-t border-border-faint pt-2.5 text-xs leading-relaxed text-navy/55">
                {r.note}
              </p>
            </Card>
          ))}
        </div>
      </Section>
    </main>
  );
}
