"use client"

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { SessionCreateDialog } from "@/components/admin/session-create-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { SessionStatus } from "@/generated/prisma/client"
import { getStatusLabel } from "@/lib/session"

type SessionListItem = {
  id: string
  title: string
  status: SessionStatus
  committeeSize: number
  createdAt: string
  _count: {
    applications: number
    committeeMembers: number
  }
}

function getBadgeStyle(status: SessionStatus) {
  if (status === "draft") {
    return { variant: "secondary" as const, className: "" }
  }

  if (status === "closed") {
    return { variant: "outline" as const, className: "" }
  }

  if (status === "finalized") {
    return {
      variant: "default" as const,
      className: "bg-emerald-600 text-white hover:bg-emerald-600",
    }
  }

  return { variant: "default" as const, className: "" }
}

export default function AdminSessionsPage() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionListItem[]>([])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set("page", "1")
      params.set("pageSize", "100")

      if (search) {
        params.set("search", search)
      }

      const response = await fetch(`/api/admin/sessions?${params.toString()}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setError(result.error ?? "회차 목록을 불러오지 못했습니다")
        return
      }

      const result = (await response.json()) as {
        sessions: SessionListItem[]
      }
      setSessions(result.sessions)
    } catch {
      setError("회차 목록을 불러오는 중 네트워크 오류가 발생했습니다")
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions])

  const columns: ColumnDef<SessionListItem>[] = useMemo(
    () => [
      {
        id: "index",
        header: "순서",
        cell: ({ row }) => row.index + 1,
      },
      {
        accessorKey: "title",
        header: "회차명",
      },
      {
        accessorKey: "status",
        header: "상태",
        cell: ({ row }) => {
          const status = row.original.status
          const style = getBadgeStyle(status)
          return (
            <Badge variant={style.variant} className={style.className}>
              {getStatusLabel(status)}
            </Badge>
          )
        },
      },
      {
        accessorKey: "committeeSize",
        header: "위원수",
        cell: ({ row }) => `${row.original.committeeSize}명`,
      },
      {
        id: "applicationsCount",
        header: "기업수",
        cell: ({ row }) => `${row.original._count.applications}개`,
      },
      {
        accessorKey: "createdAt",
        header: "등록일",
        cell: ({ row }) =>
          new Date(row.original.createdAt).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
      {
        id: "actions",
        header: "액션",
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              router.push(`/admin/sessions/${row.original.id}`)
            }}
          >
            상세 보기
          </Button>
        ),
      },
    ],
    [router],
  )

  const table = useReactTable({
    data: sessions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">평가 회차 관리</h1>
          <p className="text-sm text-stone-600">
            회차 생성 후 기업 배정과 평가 일정을 연결할 수 있습니다.
          </p>
        </div>
        <SessionCreateDialog onCreated={fetchSessions} />
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="회차명으로 검색"
          className="pl-8"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 7 }).map((_, index) => (
                  <TableHead key={index}>컬럼</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: 7 }).map((__, colIndex) => (
                    <TableCell key={`${rowIndex}-${colIndex}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>등록된 평가 회차가 없습니다</CardTitle>
            <CardDescription>
              첫 회차를 생성하면 대시보드와 평가 포털에 일정이 반영됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SessionCreateDialog onCreated={fetchSessions} />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/sessions/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
