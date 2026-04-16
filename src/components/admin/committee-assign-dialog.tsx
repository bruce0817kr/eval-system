'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Search, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

type CommitteeMember = {
  id: string
  name: string
  phone: string
  organization: string | null
  position: string | null
}

type CommitteeAssignDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  alreadyAssignedIds: string[]
  onAssigned: () => void
}

export function CommitteeAssignDialog({
  open,
  onOpenChange,
  sessionId,
  alreadyAssignedIds,
  onAssigned,
}: CommitteeAssignDialogProps) {
  const [members, setMembers] = useState<CommitteeMember[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [chairId, setChairId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchMembers = useCallback(async (search: string) => {
    setIsLoading(true)

    try {
      const params = new URLSearchParams({ pageSize: '100', isActive: 'true' })
      if (search.trim()) params.set('search', search.trim())

      const response = await fetch(`/api/admin/committee?${params.toString()}`)
      if (!response.ok) return

      const payload = (await response.json()) as { members: CommitteeMember[] }
      setMembers(
        payload.members.filter((m) => !alreadyAssignedIds.includes(m.id)),
      )
    } finally {
      setIsLoading(false)
    }
  }, [alreadyAssignedIds])

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set())
      setChairId(null)
      setErrorMessage(null)
      setSearchInput('')
      void fetchMembers('')
    }
  }, [fetchMembers, open])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => void fetchMembers(searchInput), 300)
    return () => clearTimeout(timer)
  }, [fetchMembers, open, searchInput])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (chairId === id) setChairId(null)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      setErrorMessage('배정할 위원을 선택해주세요')
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const body: { memberIds: string[]; chairId?: string } = {
        memberIds: Array.from(selectedIds),
      }
      if (chairId) body.chairId = chairId

      const response = await fetch(
        `/api/admin/sessions/${sessionId}/committee`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setErrorMessage(result.error ?? '위원 배정에 실패했습니다')
        return
      }

      onOpenChange(false)
      onAssigned()
    } catch {
      setErrorMessage('위원 배정 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>평가위원 배정</DialogTitle>
          <DialogDescription>
            이 회차에 배정할 평가위원을 선택합니다. 이미 배정된 위원은 표시되지
            않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
              placeholder="이름, 소속 검색"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                배정 가능한 위원이 없습니다
              </p>
            ) : (
              <div className="divide-y">
                {members.map((member) => {
                  const isSelected = selectedIds.has(member.id)
                  const isChair = chairId === member.id

                  return (
                    <div
                      key={member.id}
                      className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50 ${isSelected ? 'bg-muted/30' : ''}`}
                      onClick={() => toggleSelect(member.id)}
                    >
                      <div
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${isSelected ? 'border-primary bg-primary' : 'border-input'}`}
                      >
                        {isSelected && (
                          <Check className="size-3 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{member.name}</span>
                        {(member.organization || member.position) && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {[member.organization, member.position]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Button
                          type="button"
                          size="sm"
                          variant={isChair ? 'default' : 'outline'}
                          className="h-6 shrink-0 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            setChairId(isChair ? null : member.id)
                          }}
                        >
                          <Star className="size-3" />
                          {isChair ? '위원장' : '위원장 지정'}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {selectedIds.size > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedIds.size}명 선택됨
              {chairId
                ? ` · 위원장: ${members.find((m) => m.id === chairId)?.name ?? ''}`
                : ''}
            </p>
          )}

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || selectedIds.size === 0}
          >
            {isSubmitting ? '배정 중...' : `${selectedIds.size}명 배정`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
