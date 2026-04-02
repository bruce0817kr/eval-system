"use client"

import { Loader2Icon, PlusIcon } from "lucide-react"
import { type FormEvent, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type SessionCreateDialogProps = {
  onCreated?: () => void
}

export function SessionCreateDialog({ onCreated }: SessionCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [committeeSize, setCommitteeSize] = useState("5")
  const [trimRule, setTrimRule] = useState("exclude_min_max")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!title.trim()) {
      setError("회차명을 입력해주세요")
      return
    }

    setPending(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          committeeSize: Number(committeeSize),
          trimRule,
        }),
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setError(result.error ?? "회차 생성에 실패했습니다")
        return
      }

      setTitle("")
      setDescription("")
      setCommitteeSize("5")
      setTrimRule("exclude_min_max")
      setOpen(false)
      onCreated?.()
    } catch {
      setError("회차 생성 중 네트워크 오류가 발생했습니다")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" />}>
        <PlusIcon className="size-4" />
        새 회차 만들기
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 평가 회차 만들기</DialogTitle>
          <DialogDescription>
            회차 기본 정보를 입력하면 기업 배정과 평가위원 배정을 진행할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="session-title">회차명</Label>
            <Input
              id="session-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 2026년 상반기 기술평가"
              disabled={pending}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="session-description">설명</Label>
            <Textarea
              id="session-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="회차 목적, 유의사항 등을 입력하세요"
              disabled={pending}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="committee-size">위원 수</Label>
              <Input
                id="committee-size"
                type="number"
                min={1}
                max={50}
                value={committeeSize}
                onChange={(event) => setCommitteeSize(event.target.value)}
                disabled={pending}
              />
            </div>
            <div className="grid gap-2">
              <Label>절사 규칙</Label>
              <Select value={trimRule} onValueChange={(value) => { if (value !== null) setTrimRule(value) }}>
                <SelectTrigger disabled={pending}>
                  <SelectValue placeholder="절사 규칙 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exclude_min_max">최고/최저 제외</SelectItem>
                  <SelectItem value="none">절사 없음</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              생성하기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
