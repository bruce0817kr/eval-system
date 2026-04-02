"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCcwIcon } from "lucide-react";
import Link from "next/link";

export default function AdminSessionAggregationsPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aggregations, setAggregations] = useState<
    {
      id: string;
      triggerType: string;
      triggerReason: string | null;
      applicationsCount: number;
      successCount: number;
      errorCount: number;
      resultJson: any;
      computedAt: string;
      computedBy: {
        id: string;
        name: string;
        email: string;
      } | null;
    }[]
  >([]);

  const fetchAggregations = useEffect(() => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/admin/sessions/${sessionId}/aggregations`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch aggregations");
        }
        return res.json();
      })
      .then((data) => {
        setAggregations(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch aggregations:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId]);

  const getTriggerTypeLabel = (type: string) => {
    switch (type) {
      case "manual":
        return "수동";
      case "auto":
        return "자동";
      case "reopen":
        return "재개방 후";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>오류 발생</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              window.location.reload();
            }}
          >
            <RefreshCcwIcon className="size-4" />
            새로고침
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (aggregations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>집계 내역</CardTitle>
          <CardDescription>
            아직 실행된 집계가 없습니다. 평가가 모두 완료된 후 "집계 실행" 버튼을 눌러주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            집계 내역이 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>집계 내역</CardTitle>
            <Link
              href={`/admin/sessions/${sessionId}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              ← 회차 상세로 돌아가기
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>일시</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>총 기업 수</TableHead>
                  <TableHead>성공</TableHead>
                  <TableHead>실패</TableHead>
                  <TableHead>실행자</TableHead>
                  <TableHead>상세</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregations.map((agg) => (
                  <TableRow key={agg.id}>
                    <TableCell>
                      {new Date(agg.computedAt).toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getTriggerTypeLabel(
                        agg.triggerType
                      )}</Badge>
                    </TableCell>
                    <TableCell>{agg.applicationsCount}</TableCell>
                    <TableCell>
                      <Badge variant="default">{agg.successCount}</Badge>
                    </TableCell>
                    <TableCell>
                      {agg.errorCount > 0 ? (
                        <Badge variant="destructive">{agg.errorCount}</Badge>
                      ) : (
                        <Badge variant="secondary">0</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {agg.computedBy ? (
                        <>
                          <div className="font-medium">{agg.computedBy.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {agg.computedBy.email}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">시스템</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/sessions/${sessionId}/aggregations/${agg.id}` as any}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        상세 보기
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}