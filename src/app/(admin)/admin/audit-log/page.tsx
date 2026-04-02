import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function AdminAuditLogPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">감사 로그</h1>
        <p className="text-sm text-stone-600">
          사용자 활동과 주요 변경 이력을 추적하는 화면입니다.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>표시할 감사 로그가 없습니다</CardTitle>
          <CardDescription>
            회차 생성, 기업 등록, 평가 제출이 시작되면 이력이 여기에 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline">
            로그 새로고침
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
