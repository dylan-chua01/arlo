// Shared by the task form, the server actions and the bots' tools, so it
// imports nothing server-only

// Schedules a person picks most often, all at 9 in the morning
export const SCHEDULE_PRESETS = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every day", cron: "0 9 * * *" },
  { label: "Weekdays", cron: "0 9 * * 1-5" },
  { label: "Every Monday", cron: "0 9 * * 1" },
  { label: "Monthly", cron: "0 9 1 * *" },
] as const

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
