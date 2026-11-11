"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={<AlertTriangle className="h-4 w-4 text-danger" />}
        title="Something went wrong"
        description={`This page failed to load. Your data is safe. ${error.digest ? `Reference: ${error.digest}` : ""}`}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Card>
  );
}
