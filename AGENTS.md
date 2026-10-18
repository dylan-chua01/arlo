<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Git

- Never create branches, worktrees, or commits automatically. Only do so when the user explicitly asks for that specific action in the current request.
- Leave changes uncommitted in the working tree on the current branch and let the user decide when and how to commit.

# Forms

Reference implementation: `lib/db/schema.ts` (`insertBotSchema`), `actions/bot.ts` (`createBot`), `components/bot-dialog.tsx`.

## Validation schema

- Generate it from the Drizzle table with `createInsertSchema` from `drizzle-zod`, in `lib/db/schema.ts` directly below the table. Never hand-write a parallel zod schema for a table.
- Put validation rules and user-facing messages in the column refinement callbacks (`name: (s) => s.trim().min(1, "…")`).
- `.pick()` only the fields the user fills in. Server-owned columns (`id`, `userId`, `createdAt`, …) never appear in the schema. Use `.required()` for columns that have a DB default but that the form must always send.
- Export the inferred type (`z.infer<typeof insertXSchema>`). The form and the server action share this one schema and type.
- Use zod 4 (`import { z } from "zod"`). If npm reports a peer conflict from `@hookform/resolvers` → `@typeschema/zod` (an optional peer that still pins zod 3), install with `--legacy-peer-deps`.

## Server actions

- One file per entity: `actions/<entity>.ts`, with `"use server"` at the top.
- Start every action with `const { isAuthenticated, userId } = await auth()` from `@clerk/nextjs/server`. Take `userId` only from Clerk, never from the client input.
- Re-validate the input with `schema.safeParse()` on the server even though the client already validated.
- Return a result union, `{ success: true, … } | { success: false; error: string }`, rather than throwing for expected failures. Format zod errors with `z.prettifyError`.
- Turn empty optional strings into `null` before inserting, and call `revalidatePath` after the mutation.

## Form components

- Client component (`"use client"`) using `react-hook-form`: `useForm({ resolver: zodResolver(schema), defaultValues })`.
- Render each field with `Controller` and the shadcn `Field` pieces: `Field data-invalid={fieldState.invalid}`, `FieldLabel htmlFor`, the control with a matching `id` and `aria-invalid={fieldState.invalid}`, and `FieldError errors={[fieldState.error]}`. Wrap the fields in a `FieldGroup`.
- For nullable columns, give the control `value={field.value ?? ""}`.
- Use `useWatch` to read values for the UI (previews, active states) and `form.setValue(…, { shouldValidate: true })` to fill fields programmatically.
- Use `ToggleGroup` for preset or option chips, not looped `Button`s.
- Show the pending state with `form.formState.isSubmitting`: disable the submit `Button` and add a `Spinner data-icon="inline-start"`.
- Report the action's result with `toast.add({ type, title, description })` from `@/components/ui/toast` (Base UI, not sonner).
- Generate random client values such as seeds in a `getDefaultValues()` function so each reset gets fresh ones.

## Forms in dialogs

- The component owns its `Dialog`, takes the trigger as `children: React.ReactElement`, and renders it with `<DialogTrigger render={children} />`. This is Base UI, so use `render`, not `asChild`. Server pages wrap their existing button in the component.
- Control `open` with state and close it on success.
- Give the `<form>` an `id`. Put the actions in `DialogFooter`: Cancel as `<DialogClose render={<Button variant="outline" />}>` and submit as `<Button type="submit" form="<id>">`.
- Reset in `onOpenChangeComplete` when it closes (`form.reset(getDefaultValues())`), not in `onOpenChange`, so the form doesn't visibly clear during the close animation.

## Verify

Run `npx tsc --noEmit`, `npx eslint <changed files>`, and `npm run build` (which catches client bundles importing server-only code).

# Database

- Apply schema changes with `npm run db:push` (`drizzle-kit push`) only.
- Never generate or run migrations (`drizzle-kit generate`, `drizzle-kit migrate`), and never create a `drizzle/` migrations folder.
- This is a development project. There is no backwards compatibility and the data is worthless. Prefer data loss: never backfill, migrate, or preserve existing rows, and never spend effort on keeping old data working. Every schema change means a clean slate.

## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`, `trigger-authoring-tasks`, `trigger-chat-agent-advanced`, `trigger-cost-savings`, `trigger-getting-started`, `trigger-realtime-and-frontend`.
<!-- TRIGGER.DEV SKILLS END -->
