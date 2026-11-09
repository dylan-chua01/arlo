"use client"

import * as React from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  formatTime,
  parseSchedule,
  toCron,
  WEEKDAYS,
  type Repeat,
  type Schedule,
} from "@/lib/cron"

const REPEATS: { value: Repeat | "custom"; label: string }[] = [
  { value: "hourly", label: "Every hour" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "custom", label: "Custom (cron)" },
]

// Monday first, the way most calendars read
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

// Every quarter hour, plus the schedule's own time if it's in between
function timeOptions(hour: number, minute: number) {
  const times = Array.from({ length: 96 }, (_, i) => ({
    hour: Math.floor(i / 4),
    minute: (i % 4) * 15,
  }))
  if (minute % 15 !== 0) {
    times.push({ hour, minute })
    times.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  }
  return times
}

function minuteOptions(minute: number) {
  return [...new Set([0, 15, 30, 45, minute])].sort((a, b) => a - b)
}

// Switching how often it repeats keeps the time it already had
function withRepeat(repeat: Repeat, from: Schedule | null): Schedule {
  const hour = from && "hour" in from ? from.hour : 9
  const minute = from?.minute ?? 0
  switch (repeat) {
    case "hourly":
      return { repeat, minute }
    case "daily":
    case "weekdays":
      return { repeat, hour, minute }
    case "weekly":
      return {
        repeat,
        days: from?.repeat === "weekly" ? from.days : [1],
        hour,
        minute,
      }
    case "monthly":
      return {
        repeat,
        day: from?.repeat === "monthly" ? from.day : 1,
        hour,
        minute,
      }
  }
}

// Edits a cron string through dropdowns. A cron they can't show, like one a
// bot set up in chat, opens as custom.
export function SchedulePicker({
  id,
  value,
  onChange,
  invalid,
}: {
  // For the label of the first dropdown
  id: string
  value: string
  onChange: (cron: string) => void
  invalid?: boolean
}) {
  const parsed = parseSchedule(value)
  // Kept apart from the value, so a custom cron that happens to look friendly
  // doesn't jump out of custom while it's typed
  const [custom, setCustom] = React.useState(parsed === null)
  const schedule = custom ? null : parsed

  function update(next: Schedule) {
    onChange(toCron(next))
  }

  return (
    <div className="flex flex-col gap-3">
      <NativeSelect
        id={id}
        className="w-full"
        value={schedule?.repeat ?? "custom"}
        aria-invalid={invalid}
        onChange={(event) => {
          const repeat = event.target.value as Repeat | "custom"
          if (repeat === "custom") {
            setCustom(true)
            return
          }
          setCustom(false)
          update(withRepeat(repeat, parsed))
        }}
      >
        {REPEATS.map((repeat) => (
          <NativeSelectOption key={repeat.value} value={repeat.value}>
            {repeat.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {schedule?.repeat === "weekly" && (
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          className="flex-wrap"
          aria-label="Days of the week"
          value={schedule.days.map(String)}
          onValueChange={(values) => {
            // At least one day, or it would never run
            if (values.length === 0) return
            update({ ...schedule, days: values.map(Number).sort() })
          }}
        >
          {WEEK_ORDER.map((day) => (
            <ToggleGroupItem
              key={day}
              value={String(day)}
              aria-label={WEEKDAYS[day]}
            >
              {WEEKDAYS[day].slice(0, 3)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {schedule && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {schedule.repeat === "monthly" && (
            <>
              <span className="text-muted-foreground">On the</span>
              <NativeSelect
                aria-label="Day of the month"
                value={schedule.day}
                onChange={(event) =>
                  update({ ...schedule, day: Number(event.target.value) })
                }
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <NativeSelectOption key={day} value={day}>
                    {day}
                    {day > 28 ? " (skips shorter months)" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </>
          )}
          {schedule.repeat === "hourly" ? (
            <>
              <span className="text-muted-foreground">At</span>
              <NativeSelect
                aria-label="Minutes past the hour"
                value={schedule.minute}
                onChange={(event) =>
                  update({ ...schedule, minute: Number(event.target.value) })
                }
              >
                {minuteOptions(schedule.minute).map((minute) => (
                  <NativeSelectOption key={minute} value={minute}>
                    {minute === 0
                      ? "On the hour"
                      : `${String(minute).padStart(2, "0")} past`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">At</span>
              <NativeSelect
                aria-label="Time"
                value={`${schedule.hour}:${schedule.minute}`}
                onChange={(event) => {
                  const [hour, minute] = event.target.value
                    .split(":")
                    .map(Number)
                  update({ ...schedule, hour, minute })
                }}
              >
                {timeOptions(schedule.hour, schedule.minute).map(
                  ({ hour, minute }) => (
                    <NativeSelectOption
                      key={`${hour}:${minute}`}
                      value={`${hour}:${minute}`}
                    >
                      {formatTime(hour, minute)}
                    </NativeSelectOption>
                  )
                )}
              </NativeSelect>
            </>
          )}
        </div>
      )}

      {!schedule && (
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor={`${id}-cron`} className="sr-only">
            Cron expression
          </FieldLabel>
          <Input
            id={`${id}-cron`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="0 9 * * 1-5"
            autoComplete="off"
            className="font-mono"
            aria-invalid={invalid}
          />
        </Field>
      )}
    </div>
  )
}
