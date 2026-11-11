"use client"

import { useEffect, useRef, useState } from "react"
import { MicIcon, SquareIcon } from "lucide-react"

import { transcribeAudio } from "@/actions/voice"
import {
  PromptInputButton,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useUpgradeToast } from "@/hooks/use-upgrade-toast"
import { UPGRADE_ERROR } from "@/lib/billing"
import { cn } from "@/lib/utils"

// Long enough for a detailed instruction, short enough to stay well under the
// server's size limit
const MAX_SECONDS = 120

type State = "idle" | "recording" | "transcribing"

// Records a voice message and writes what was said into the composer, so it
// can be checked or edited before sending. Works in every browser that can
// record, since the server does the transcribing.
export function VoiceInput() {
  const { textInput } = usePromptInputController()
  const showUpgradeToast = useUpgradeToast()
  const [state, setState] = useState<State>("idle")
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const discardRef = useRef(false)
  // The latest draft, for appending once the transcript arrives
  const inputRef = useRef(textInput)
  useEffect(() => {
    inputRef.current = textInput
  })

  // Release the microphone if the chat closes mid-recording
  useEffect(
    () => () => {
      discardRef.current = true
      if (recorderRef.current?.state === "recording") recorderRef.current.stop()
    },
    []
  )

  useEffect(() => {
    if (state !== "recording") return
    const started = Date.now()
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000)
      setSeconds(elapsed)
      if (elapsed >= MAX_SECONDS) recorderRef.current?.stop()
    }, 250)
    return () => clearInterval(timer)
  }, [state])

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      toast.add({
        type: "error",
        title: "Can't record here",
        description: "This browser doesn't support voice recording.",
      })
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      toast.add({
        type: "error",
        title: "Couldn't use the microphone",
        description: "Allow microphone access for this site and try again.",
      })
      return
    }

    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    discardRef.current = false
    recorder.addEventListener("dataavailable", (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    })
    recorder.addEventListener("stop", () => {
      for (const track of stream.getTracks()) track.stop()
      recorderRef.current = null
      if (discardRef.current) return
      // Chrome and Firefox record webm, Safari mp4
      const audio = new Blob(chunks, {
        type: recorder.mimeType || chunks[0]?.type || "audio/webm",
      })
      void transcribe(audio)
    })

    recorderRef.current = recorder
    recorder.start()
    setSeconds(0)
    setState("recording")
  }

  async function transcribe(audio: Blob) {
    setState("transcribing")
    try {
      const formData = new FormData()
      formData.set("audio", audio)
      const result = await transcribeAudio(formData)
      if (!result.success) {
        if (result.error === UPGRADE_ERROR) {
          showUpgradeToast("Couldn't transcribe")
        } else {
          toast.add({
            type: "error",
            title: "Couldn't transcribe",
            description: result.error,
          })
        }
        return
      }
      const { value, setInput } = inputRef.current
      setInput(value.trim() ? `${value.trimEnd()} ${result.text}` : result.text)
    } catch {
      toast.add({
        type: "error",
        title: "Couldn't transcribe",
        description: "Check your connection and try again.",
      })
    } finally {
      setState("idle")
    }
  }

  if (state === "transcribing") {
    return (
      <PromptInputButton aria-label="Transcribing" disabled>
        <Spinner />
      </PromptInputButton>
    )
  }

  const recording = state === "recording"
  return (
    <PromptInputButton
      aria-label={recording ? "Stop recording" : "Record a voice message"}
      aria-pressed={recording}
      tooltip={recording ? "Stop recording" : "Record a voice message"}
      onClick={() => (recording ? recorderRef.current?.stop() : void start())}
      className={cn(
        recording &&
          "text-destructive hover:bg-destructive/10 hover:text-destructive"
      )}
    >
      {recording ? (
        <>
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-destructive" />
          </span>
          <span className="tabular-nums">{formatDuration(seconds)}</span>
          <SquareIcon className="fill-current" />
        </>
      ) : (
        <MicIcon />
      )}
    </PromptInputButton>
  )
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}
