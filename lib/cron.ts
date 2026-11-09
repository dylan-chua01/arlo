// Shared by the task form, the server actions and the bots' tools, so it
// imports nothing server-only

const FIELD = /^[\d*,/-]+$/

// A standard five-field cron expression that fires at most once an hour.
// Each run is a full bot turn paid from the person's allowance, so the minute
// has to be a single number.
export function isValidCron(cron: string) {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5 || !fields.every((field) => FIELD.test(field))) {
    return false
  }
  const minute = Number(fields[0])
  return /^\d+$/.test(fields[0]) && minute >= 0 && minute <= 59
}

export const CRON_ERROR =
  "Use five cron fields (minute hour day month weekday) with a single minute, like 0 9 * * 1-5. Tasks run at most once an hour."

// An IANA time zone, like Europe/London
export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

// The schedules the task form can show without cron. Anything else a bot set
// up in chat, like "30 8,17 * * *", stays as raw cron.
export type Schedule =
  | { repeat: "hourly"; minute: number }
  | { repeat: "daily" | "weekdays"; hour: number; minute: number }
  // Days are 0 (Sunday) to 6 (Saturday)
  | { repeat: "weekly"; days: number[]; hour: number; minute: number }
  | { repeat: "monthly"; day: number; hour: number; minute: number }

export type Repeat = Schedule["repeat"]

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function inRange(text: string, min: number, max: number) {
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return value >= min && value <= max ? value : null
}

// The friendly form of a cron, or null when it doesn't have one
export function parseSchedule(cron: string): Schedule | null {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) return null
  const [m, h, dom, month, dow] = fields
  const minute = inRange(m, 0, 59)
  if (minute === null || month !== "*") return null

  if (h === "*" && dom === "*" && dow === "*")
    return { repeat: "hourly", minute }
  const hour = inRange(h, 0, 23)
  if (hour === null) return null

  if (dom === "*" && dow === "*") return { repeat: "daily", hour, minute }
  if (dom === "*" && dow === "1-5") return { repeat: "weekdays", hour, minute }
  if (dom === "*") {
    const days = dow.split(",").map((day) => inRange(day, 0, 7))
    if (days.some((day) => day === null)) return null
    // 7 is Sunday too
    const unique = [...new Set(days.map((day) => day! % 7))].sort()
    return { repeat: "weekly", days: unique, hour, minute }
  }
  const day = inRange(dom, 1, 31)
  if (day !== null && dow === "*") {
    return { repeat: "monthly", day, hour, minute }
  }
  return null
}

export function toCron(schedule: Schedule) {
  const { minute } = schedule
  switch (schedule.repeat) {
    case "hourly":
      return `${minute} * * * *`
    case "daily":
      return `${minute} ${schedule.hour} * * *`
    case "weekdays":
      return `${minute} ${schedule.hour} * * 1-5`
    case "weekly":
      return `${minute} ${schedule.hour} * * ${schedule.days.join(",")}`
    case "monthly":
      return `${minute} ${schedule.hour} ${schedule.day} * *`
  }
}

// 9:00 AM
export function formatTime(hour: number, minute: number) {
  const period = hour < 12 ? "AM" : "PM"
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${period}`
}

function ordinal(day: number) {
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th"
  return `${day}${suffix}`
}

function listDays(days: number[]) {
  const names = days.map((day) => WEEKDAYS[day])
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
    : names[0]
}

// "Every Monday at 9:00 AM", or null for a cron the form can't show
export function describeSchedule(cron: string) {
  const schedule = parseSchedule(cron)
  if (!schedule) return null
  if (schedule.repeat === "hourly") {
    return schedule.minute === 0
      ? "Every hour, on the hour"
      : `Every hour at ${schedule.minute} past`
  }
  const time = formatTime(schedule.hour, schedule.minute)
  switch (schedule.repeat) {
    case "daily":
      return `Every day at ${time}`
    case "weekdays":
      return `Weekdays at ${time}`
    case "weekly":
      return schedule.days.length === 7
        ? `Every day at ${time}`
        : `Every ${listDays(schedule.days)} at ${time}`
    case "monthly":
      return `Monthly on the ${ordinal(schedule.day)} at ${time}`
  }
}
