import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AdminCompaniesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">기업 관리</h1>
        <p className="text-sm text-stone-600">
          평가 대상 기업의 기본 정보와 제출 상태를 관리합니다.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>등록된 기업이 없습니다</CardTitle>
          <CardDescription>
            기업을 등록하면 회차별 배정과 제출 현황을 추적할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button">기업 등록하기</Button>
        </CardContent>
      </Card>
    </div>
  )
}
