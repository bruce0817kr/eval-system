import type { Metadata } from "next"
import { Noto_Sans_KR } from "next/font/google"

import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const pretendardVariable = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
})

export const metadata: Metadata = {
  title: "선정평가 시스템",
  description: "선정평가 시스템 관리자 및 평가 포털",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={pretendardVariable.variable}>
      <body className="min-h-svh font-sans antialiased bg-stone-50 text-stone-900">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
