import { Volume2 } from 'lucide-react'
import { Badge } from './badge'
import { Button } from './button'
import { Card, CardContent, CardHeader } from './card'

export type WordCardProps = {
  word: string
  translation: string
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  category?: string
  example?: string
  onSpeak?: () => void
}

export function WordCard({
  word,
  translation,
  level,
  category,
  example,
  onSpeak,
}: WordCardProps) {
  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate font-heading text-2xl font-semibold text-foreground">
            {word}
          </h3>
          <p className="text-muted-foreground">{translation}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Озвучить произношение"
          onClick={onSpeak}
        >
          <Volume2 className="size-5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{level}</Badge>
          {category ? <Badge variant="secondary">{category}</Badge> : null}
        </div>
        {example ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Пример: </span>
            {example}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
