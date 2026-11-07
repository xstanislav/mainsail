import { FileStateFile } from '@/store/files/types'

export interface ServerJobQueueState {
    queued_jobs: ServerJobQueueStateJob[]
    queue_state: string
}

export interface ServerJobQueueStateJob {
    filename: string
    source_filename?: string
    plate?: number | null
    plate_name?: string | null
    job_id: string
    time_added: number
    time_in_queue: number
    metadata?: FileStateFile | null
    isFirst?: boolean
    combinedIds?: string[]
}
