import { STAGE_ORDER, stageIndex } from '../../lib/utils'

interface StageArcProps {
  stage: string
  size?: 'sm' | 'md'
}

// Workflow progress indicator: a horizontal bar showing how far a project
// has moved through the pipeline, with the current stage labelled beneath it.
export function StageArc({ stage, size = 'md' }: StageArcProps) {
  const idx = Math.max(0, stageIndex(stage))
  const total = STAGE_ORDER.length - 1
  const progress = total > 0 ? idx / total : 0
  const pct = Math.round(progress * 100)

  const width = size === 'sm' ? 92 : 140
  const barHeight = size === 'sm' ? 5 : 6

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width }}>
      <div
        className="w-full rounded-full bg-border overflow-hidden"
        style={{ height: barHeight }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-sun transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] uppercase tracking-wide text-text-dim font-medium text-center leading-tight">
        {stage}
      </span>
    </div>
  )
}
