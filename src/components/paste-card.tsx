'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Eye, FileText, Lock, Flame, Clock, Flag, Globe, Link as LinkIcon, User as UserIcon } from 'lucide-react'
import type { SafePaste } from '@/lib/types'
import { formatRelativeTime, formatBytes } from '@/lib/ui-utils'
import { useAppStore } from '@/lib/store'

function visibilityIcon(v: string) {
  if (v === 'public') return <Globe className="h-3 w-3" />
  if (v === 'unlisted') return <LinkIcon className="h-3 w-3" />
  return <Lock className="h-3 w-3" />
}

export function PasteCard({ paste }: { paste: SafePaste }) {
  const goView = useAppStore((s) => s.goView)
  return (
    <Card
      className="cursor-pointer transition hover:border-primary/40 hover:shadow-md"
      onClick={() => goView(paste.slug)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base truncate">
              {paste.contentType === 'file' ? (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{paste.title || (paste.contentType === 'file' ? paste.originalFileName : `/${paste.slug}`)}</span>
            </CardTitle>
            {paste.description && (
              <CardDescription className="mt-1 line-clamp-2">{paste.description}</CardDescription>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            {paste.contentType === 'file' ? (
              <Badge variant="outline" className="gap-1 text-[10px]">
                {formatBytes(paste.fileSizeBytes)}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] font-mono">{paste.language}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      {paste.contentType === 'text' && paste.textContent && (
        <CardContent className="pb-3">
          <pre className="max-h-24 overflow-hidden text-xs text-muted-foreground font-mono whitespace-pre-wrap rounded bg-muted/50 p-2">
            {paste.textContent.slice(0, 280)}
            {paste.textContent.length > 280 ? '…' : ''}
          </pre>
        </CardContent>
      )}
      <CardFooter className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-0">
        <span className="flex items-center gap-1">
          <Avatar className="h-4 w-4">
            <AvatarFallback className="text-[8px] bg-muted">
              {paste.ownerName ? paste.ownerName.slice(0, 2).toUpperCase() : <UserIcon className="h-2 w-2" />}
            </AvatarFallback>
          </Avatar>
          {paste.ownerName || 'guest'}
        </span>
        <span className="flex items-center gap-1">
          {visibilityIcon(paste.visibility)}
          {paste.visibility}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" /> {paste.viewCount}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {formatRelativeTime(paste.createdAt)}
        </span>
        {paste.burnAfterRead && (
          <Badge variant="destructive" className="gap-1 text-[10px] px-1 py-0">
            <Flame className="h-2.5 w-2.5" /> burn
          </Badge>
        )}
        {paste.hasPassword && (
          <Badge variant="outline" className="gap-1 text-[10px] px-1 py-0">
            <Lock className="h-2.5 w-2.5" /> password
          </Badge>
        )}
        {paste.isFlagged && (
          <Badge variant="destructive" className="gap-1 text-[10px] px-1 py-0">
            <Flag className="h-2.5 w-2.5" /> flagged
          </Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 px-2 text-[11px]"
          onClick={(e) => {
            e.stopPropagation()
            goView(paste.slug)
          }}
        >
          Open →
        </Button>
      </CardFooter>
    </Card>
  )
}
