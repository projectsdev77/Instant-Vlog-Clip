import { Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { StepFooter, StepHeading, StepPage } from '@/features/project/ProjectLayout'
import { stepIndex, stepPath, stepsFor } from '@/features/project/steps'
import { transcribeAll } from '@/pipeline/voiceTrack'
import { currentEdit, useProject } from '@/store/projectStore'
import { Tour } from '@/features/tutorial/Tour'
import { VoiceStudio } from './VoiceStudio'

/** "Record my own": the voiceover is recorded over the made vlog, then on to Edit. */
export function RecordStep() {
  const { project, clips, updateProject } = useProject()
  const navigate = useNavigate()
  if (!project) return null
  const plan = currentEdit(project)
  if (!plan) return <Navigate to={stepPath(project.id, 'generate')} replace />
  const takes = project.voiceTrack?.takes ?? []

  const next = async () => {
    void transcribeAll()
    if (stepIndex(project.step) < stepIndex('edit')) await updateProject({ step: 'edit' })
    navigate(stepPath(project.id, 'edit'))
  }

  return (
    <>
      <StepPage>
        <StepHeading
          step={stepsFor(project.voice.mode).findIndex((s) => s.id === 'record') + 1}
          title="Record your voiceover"
          sub="Your vlog is ready. Play it and talk over it, all in one go or a bit at a time."
        />
        <VoiceStudio project={project} clips={clips} plan={plan} />
      </StepPage>
      <Tour page="record" />
      <StepFooter summary={takes.length ? `${takes.length} take${takes.length === 1 ? '' : 's'} recorded` : 'Nothing recorded yet'}>
        <Button variant={takes.length ? 'ember' : 'quiet'} onClick={() => void next()}>
          {takes.length ? 'Continue to edit' : 'Skip for now'}
        </Button>
      </StepFooter>
    </>
  )
}
