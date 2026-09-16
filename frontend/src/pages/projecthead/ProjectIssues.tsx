import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { Card, SectionHeading, Pill, EmptyState, inputCls } from '../../components/shared/Primitives'
import { formatDate } from '../../lib/utils'

const TABS = ['Open', 'Resolved', 'All'] as const

export default function ProjectIssues() {
  const { projectIssues, resolveProjectIssue } = useApp()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Open')
  const [notesById, setNotesById] = useState<Record<string, string>>({})

  const filtered = useMemo(() => projectIssues.filter((i) => tab === 'All' || i.status === tab), [projectIssues, tab])

  return (
    <div className="space-y-5">
      <SectionHeading eyebrow="Project → Project Head" title="Project Issues" action={<span className="text-xs text-text-dim">{filtered.length} of {projectIssues.length}</span>} />

      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {TABS.map((t) => {
          const count = projectIssues.filter((i) => t === 'All' || i.status === t).length
          return (
            <button key={t} onClick={() => setTab(t)} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${tab === t ? 'bg-sun/10 text-sun' : 'text-text-dim hover:text-text hover:bg-black/[0.035]'}`}>
              {t} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing here" message="No issues match this view." />
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-text">{i.projectCode}</div>
                  <div className="text-xs text-text-dim mt-1">{i.description}</div>
                  <div className="text-xs text-text-dim mt-1">Raised by {i.raisedBy} · {formatDate(i.raisedOn)}</div>
                  {i.resolutionNotes && <div className="text-xs text-teal mt-1 italic">Resolved: {i.resolutionNotes} ({formatDate(i.resolvedOn ?? '')})</div>}
                </div>
                <Pill status={i.status === 'Open' ? 'Issue Raised' : 'Completed'} />
              </div>
              {i.status === 'Open' && (
                <div className="flex gap-2 mt-3">
                  <input
                    value={notesById[i.id] ?? ''}
                    onChange={(e) => setNotesById((prev) => ({ ...prev, [i.id]: e.target.value }))}
                    placeholder="Resolution notes"
                    className={inputCls}
                  />
                  <button
                    onClick={() => notesById[i.id]?.trim() && resolveProjectIssue(i.id, notesById[i.id].trim())}
                    className="text-xs font-medium px-3 py-2 rounded-lg bg-teal/10 text-teal border border-teal/30 hover:bg-teal/20 transition-colors whitespace-nowrap"
                  >
                    Resolve
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
