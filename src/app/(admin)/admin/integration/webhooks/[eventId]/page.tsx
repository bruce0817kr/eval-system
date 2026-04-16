"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { RefreshCcwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Delivery = {
  eventId: string
  eventType: string
  url: string
  payloadJson: unknown
  status: string
  attempts: number
  lastStatus: number | null
  lastError: string | null
  createdAt: string
  updatedAt: string
  deliveredAt: string | null
}

export default function IntegrationWebhookDetailPage() {
  const params = useParams<{ eventId: string }>()
  const eventId = params.eventId
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDelivery = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/integration/webhooks/${encodeURIComponent(eventId)}`)
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Failed to load webhook delivery")
      }

      const data = (await response.json()) as { delivery: Delivery }
      setDelivery(data.delivery)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load webhook delivery")
    } finally {
      setIsLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void loadDelivery()
  }, [loadDelivery])

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !delivery) {
    return (
      <div className="space-y-4 p-6">
        <Link className="text-sm text-muted-foreground hover:underline" href="/admin/integration/webhooks">
          Back
        </Link>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>{error ?? "Webhook delivery was not found"}</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Webhook Delivery Detail</h1>
          <p className="font-mono text-xs text-muted-foreground">{delivery.eventId}</p>
        </div>
        <Link className="text-sm text-muted-foreground hover:underline" href="/admin/integration/webhooks">
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {delivery.eventType}
            <Badge>{delivery.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>URL: {delivery.url}</div>
          <div>Attempts: {delivery.attempts}</div>
          <div>Last status: {delivery.lastStatus ?? "-"}</div>
          <div>Last error: {delivery.lastError ?? "-"}</div>
          <div>Updated: {new Date(delivery.updatedAt).toLocaleString()}</div>
          <pre className="max-h-[520px] overflow-auto rounded-md bg-stone-950 p-3 text-xs text-stone-50">
            {JSON.stringify(delivery.payloadJson, null, 2)}
          </pre>
          <Button type="button" variant="outline" onClick={() => void loadDelivery()}>
            <RefreshCcwIcon className="size-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
