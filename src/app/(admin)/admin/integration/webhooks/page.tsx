"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCcwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Delivery = {
  eventId: string
  eventType: string
  url: string
  status: string
  attempts: number
  lastStatus: number | null
  lastError: string | null
  updatedAt: string
  deliveredAt: string | null
}

export default function IntegrationWebhooksPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replayingEventId, setReplayingEventId] = useState<string | null>(null)

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/integration/webhooks")
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Failed to load webhook deliveries")
      }

      const data = (await response.json()) as { deliveries: Delivery[] }
      setDeliveries(data.deliveries)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load webhook deliveries")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDeliveries()
  }, [loadDeliveries])

  const replay = async (eventId: string) => {
    setReplayingEventId(eventId)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/integration/webhooks/${encodeURIComponent(eventId)}/replay`,
        { method: "POST" },
      )
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Replay failed")
      }

      await loadDeliveries()
    } catch (replayError) {
      setError(replayError instanceof Error ? replayError.message : "Replay failed")
    } finally {
      setReplayingEventId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Integration Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Delivery history and manual replay for business-management callbacks.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadDeliveries()}>
          <RefreshCcwIcon className="size-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Webhook Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhook deliveries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last Response</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((delivery) => (
                  <TableRow key={delivery.eventId}>
                    <TableCell>
                      <div className="max-w-[420px] truncate font-mono text-xs">
                        {delivery.eventId}
                      </div>
                      <div className="text-xs text-muted-foreground">{delivery.eventType}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={delivery.status === "delivered" ? "default" : "secondary"}>
                        {delivery.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{delivery.attempts}</TableCell>
                    <TableCell>
                      {delivery.lastStatus ?? "-"}
                      {delivery.lastError ? (
                        <div className="text-xs text-destructive">{delivery.lastError}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>{new Date(delivery.updatedAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={replayingEventId === delivery.eventId}
                        onClick={() => void replay(delivery.eventId)}
                      >
                        Replay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
