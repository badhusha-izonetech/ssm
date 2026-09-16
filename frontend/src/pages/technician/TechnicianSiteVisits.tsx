import { useState } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card } from '../../components/shared/Primitives'
import { Navigation, CheckCircle2, ChevronRight } from 'lucide-react'
import { TechnicianSiteVisitDetail } from './TechnicianSiteVisitDetail'
import { Pagination } from '../../components/shared/Pagination'

export default function TechnicianSiteVisits() {
  const { employee } = useAuth()
  const { projects, siteVisits } = useApp()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const myProjects = projects.filter(p => p.assignedTechnicianId === employee?.id && p.status !== 'Completed')
  const [currentPage, setCurrentPage] = useState(1)
  const paginatedProjects = myProjects.slice((currentPage - 1) * 25, currentPage * 25)

  if (selectedProjectId) {
    const project = myProjects.find(p => p.id === selectedProjectId)
    if (!project) return null
    return (
      <TechnicianSiteVisitDetail 
        project={project} 
        onBack={() => setSelectedProjectId(null)} 
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sun/10 text-sun flex items-center justify-center shrink-0">
          <Navigation size={20} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-dim font-medium mb-0.5">Field Work</div>
          <h1 className="text-xl font-display font-bold text-text">My Site Visits</h1>
        </div>
      </div>

      {myProjects.length === 0 ? (
        <div className="py-12 text-center text-text-dim border border-dashed border-border rounded-xl">
          No projects currently assigned to you for installation.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedProjects.map(project => {
              const projectVisits = siteVisits.filter(v => v.projectId === project.id && v.siteType !== 'Final Review')
              const visit = projectVisits.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]
              
              return (
                <Card key={project.id} className="p-5 flex flex-col group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-mono text-xs text-teal font-medium mb-1">{project.id}</div>
                      <div className="font-semibold text-text">{project.customerName}</div>
                    </div>
                    {visit?.status === 'Completed' ? (
                      <div className="bg-teal/10 text-teal text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={12} /> Completed
                      </div>
                    ) : visit?.status === 'In Progress' ? (
                      <div className="bg-sun/10 text-sun text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-sun animate-pulse" /> In Progress
                      </div>
                    ) : (
                      <div className="bg-black/5 text-text-dim text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full">
                        Not Started
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 mb-6 flex-1">
                    <div className="text-sm flex justify-between">
                      <span className="text-text-dim">System:</span>
                      <span className="font-medium">ON-GRID {project.capacityKw}kW</span>
                    </div>
                    <div className="text-sm flex justify-between">
                      <span className="text-text-dim">Location:</span>
                      <span className="font-medium truncate max-w-[150px]">{project.site}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedProjectId(project.id)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-panel-raised border border-border text-sm font-medium hover:bg-black/5 hover:border-black/10 transition-all group-hover:shadow-sm"
                  >
                    {visit?.status === 'Completed' ? 'View Details' : (visit?.status === 'In Progress' ? 'Continue Work' : 'Start Visit')}
                    <ChevronRight size={16} />
                  </button>
                </Card>
              )
            })}
          </div>
          <div className="drop-shadow-xs">
            <Pagination currentPage={currentPage} totalItems={myProjects.length} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}
    </div>
  )
}
