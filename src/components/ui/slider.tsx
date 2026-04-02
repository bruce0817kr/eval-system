"use client"

import * as React from 'react'

import { cn } from '@/lib/utils'

type SliderProps = {
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
  className?: string
  disabled?: boolean
}

function Slider({
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
  disabled,
}: SliderProps) {
  const [innerValue, setInnerValue] = React.useState<number>(
    defaultValue?.[0] ?? min,
  )
  const currentValue = value?.[0] ?? innerValue

  return (
    <div className={cn('w-full', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value)

          if (!value) {
            setInnerValue(next)
          }

          onValueChange?.([next])
        }}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary disabled:cursor-not-allowed"
      />
    </div>
  )
}

export { Slider }
