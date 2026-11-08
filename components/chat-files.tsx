"use client"

import { createContext, use, useState } from "react"
import {
  DownloadIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  LinkIcon,
  PresentationIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Bot } from "@/lib/db/schema"
import {
  fileHref,
  formatFileSize,
  isPreviewableImage,
  parseFileUrl,
} from "@/lib/files"
import type { ChatUIMessage } from "@/trigger/tools"

type ChatBot = Pick<Bot, "id" | "name" | "avatar">

// A file stored with the chat, shown by id
export type ChatFileRef = {
  fileId: string
  name: string
  mediaType: string
  size?: number
}

// The header's Files button opens the sheet the chat renders, since the
// chat holds the messages
const ChatFilesContext = createContext<{
  open: boolean
  setOpen: (open: boolean) => void
} | null>(null)

export function ChatFilesProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <ChatFilesContext value={{ open, setOpen }}>{children}</ChatFilesContext>
  )
}

export function useChatFiles() {
  const context = use(ChatFilesContext)
  if (!context) {
    throw new Error("useChatFiles must be used within ChatFilesProvider")
  }
  return context
}

export function ChatFilesTrigger({ className }: { className?: string }) {
  const { open, setOpen } = useChatFiles()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label="Files, images and links"
      aria-pressed={open}
      onClick={() => setOpen(!open)}
    >
      <FolderIcon />
    </Button>
  )
}

function FileTypeIcon({
  mediaType,
  className,
}: {
  mediaType: string
  className?: string
}) {
  const Icon = mediaType.startsWith("image/")
    ? ImageIcon
    : mediaType.includes("presentation") || mediaType.includes("powerpoint")
      ? PresentationIcon
      : mediaType.includes("sheet") ||
          mediaType.includes("excel") ||
          mediaType === "text/csv"
        ? FileSpreadsheetIcon
        : mediaType.startsWith("text/") ||
            mediaType.includes("document") ||
            mediaType.includes("word") ||
            mediaType === "application/pdf"
          ? FileTextIcon
          : FileIcon
  return <Icon className={className} />
}

// A file in a message: images show as a picture, everything else as a card
// with a download button
export function FileCard({ file }: { file: ChatFileRef }) {
  if (isPreviewableImage(file.mediaType)) {
    return (
      <a
        href={fileHref(file.fileId)}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-fit overflow-hidden rounded-lg border"
      >
        {/* Served by our own route, which next/image can't optimize */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileHref(file.fileId)}
          alt={file.name}
          className="max-h-80 w-auto max-w-full object-contain"
        />
      </a>
    )
  }
  return (
    <Item variant="outline" size="sm" className="w-full max-w-sm bg-background">
      <ItemMedia variant="icon">
        <FileTypeIcon mediaType={file.mediaType} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full truncate">{file.name}</ItemTitle>
        {file.size !== undefined && (
          <ItemDescription>{formatFileSize(file.size)}</ItemDescription>
        )}
      </ItemContent>
      <ItemActions>
        <DownloadButton file={file} />
      </ItemActions>
    </Item>
  )
}

function DownloadButton({ file }: { file: ChatFileRef }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Download ${file.name}`}
      nativeButton={false}
      render={<a href={fileHref(file.fileId, { download: true })} download />}
    >
      <DownloadIcon />
    </Button>
  )
}

type FileEntry = ChatFileRef & { from: string }
type ImageEntry = {
  key: string
  src: string
  alt: string
  from: string
  file?: ChatFileRef
}
type LinkEntry = { url: string; from: string }

// Everything worth finding again in a chat, newest first
function collect(messages: ChatUIMessage[], bots?: ChatBot[]) {
  const files: FileEntry[] = []
  const images: ImageEntry[] = []
  const links = new Map<string, LinkEntry>()

  for (const message of messages) {
    // Sent by the chat itself when a bot hands over
    if (message.metadata?.relay) continue
    const from =
      message.role === "user"
        ? "You"
        : (bots?.find((bot) => bot.id === message.metadata?.botId)?.name ??
          (bots ? "A bot" : "Bot"))

    message.parts.forEach((part, i) => {
      let file: ChatFileRef | undefined
      if (part.type === "file") {
        const fileId = parseFileUrl(part.url)
        if (fileId) {
          file = {
            fileId,
            name: part.filename ?? "Attachment",
            mediaType: part.mediaType,
          }
        }
      } else if (
        part.type === "tool-shareFile" &&
        part.state === "output-available"
      ) {
        file = part.output
      } else if (
        part.type === "tool-showScreen" &&
        part.state === "output-available"
      ) {
        images.push({
          key: `${message.id}-${i}`,
          src: `data:${part.output.mediaType};base64,${part.output.base64}`,
          alt: "Screenshot of the bot's screen",
          from: `${from}, screenshot`,
        })
      } else if (part.type === "text") {
        for (const url of findLinks(part.text)) {
          // Keep the latest mention of each link
          links.delete(url)
          links.set(url, { url, from })
        }
      }

      if (!file) return
      if (isPreviewableImage(file.mediaType)) {
        images.push({
          key: file.fileId,
          src: fileHref(file.fileId),
          alt: file.name,
          from,
          file,
        })
      } else {
        files.push({ ...file, from })
      }
    })
  }

  return {
    files: files.toReversed(),
    images: images.toReversed(),
    links: [...links.values()].toReversed(),
  }
}

// Web addresses in a message, without the punctuation around them
function findLinks(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"'`\])}]+/g) ?? []
  return matches.flatMap((match) => {
    const url = match.replace(/[.,;:!?*_~]+$/, "")
    try {
      return new URL(url).protocol.startsWith("http") ? [url] : []
    } catch {
      return []
    }
  })
}

export function ChatFilesSheet({
  messages,
  bots,
}: {
  messages: ChatUIMessage[]
  bots?: ChatBot[]
}) {
  const { open, setOpen } = useChatFiles()
  const { files, images, links } = collect(messages, bots)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Files, images and links</SheetTitle>
          <SheetDescription>
            Everything shared in this chat, newest first.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="files" className="min-h-0 flex-1 gap-0">
          <div className="px-4 pt-4">
            <TabsList className="w-full">
              <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
              <TabsTrigger value="images">Images ({images.length})</TabsTrigger>
              <TabsTrigger value="links">Links ({links.length})</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="files" className="min-h-0 overflow-y-auto p-4">
            {files.length === 0 ? (
              <EmptyTab
                icon={<FileIcon />}
                title="No files yet"
                description="Documents, decks and spreadsheets you attach or a bot makes show up here."
              />
            ) : (
              <ItemGroup className="gap-2">
                {files.map((file) => (
                  <Item key={file.fileId} variant="outline" size="sm">
                    <ItemMedia variant="icon">
                      <FileTypeIcon mediaType={file.mediaType} />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full truncate">
                        <a
                          href={fileHref(file.fileId, { download: true })}
                          download
                          className="truncate hover:underline"
                        >
                          {file.name}
                        </a>
                      </ItemTitle>
                      <ItemDescription>
                        {[
                          file.from,
                          file.size !== undefined && formatFileSize(file.size),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <DownloadButton file={file} />
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </TabsContent>
          <TabsContent value="images" className="min-h-0 overflow-y-auto p-4">
            {images.length === 0 ? (
              <EmptyTab
                icon={<ImageIcon />}
                title="No images yet"
                description="Images you attach, ones a bot shares, and screenshots of a bot's screen show up here."
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {images.map((image) => (
                  <figure
                    key={image.key}
                    className="flex min-w-0 flex-col gap-1"
                  >
                    <a
                      href={image.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      // A data: screenshot can't open in a new tab, so it downloads
                      download={image.file ? undefined : "screenshot.jpg"}
                      className="block aspect-square overflow-hidden rounded-lg border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.src}
                        alt={image.alt}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </a>
                    <figcaption className="truncate text-xs text-muted-foreground">
                      {image.file ? `${image.file.name} · ` : ""}
                      {image.from}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="links" className="min-h-0 overflow-y-auto p-4">
            {links.length === 0 ? (
              <EmptyTab
                icon={<LinkIcon />}
                title="No links yet"
                description="Web addresses posted in the chat, by you or a bot, show up here."
              />
            ) : (
              <ItemGroup className="gap-2">
                {links.map((link) => (
                  <Item
                    key={link.url}
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <ItemMedia variant="icon">
                      <LinkIcon />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full truncate">
                        {new URL(link.url).hostname}
                      </ItemTitle>
                      <ItemDescription className="truncate">
                        {link.from} · {link.url}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function EmptyTab({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
