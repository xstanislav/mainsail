import { GetterTree } from 'vuex'
import { ServerJobQueueState, ServerJobQueueStateJob } from '@/store/server/jobQueue/types'
import { FileStateThreeMfPlate } from '@/store/files/types'
import Vue from 'vue'
import { RootState } from '@/store/types'

export const getters: GetterTree<ServerJobQueueState, RootState> = {
    getJobs: (state, getters, rootState, rootGetters) => {
        const jobs: ServerJobQueueStateJob[] = []

        state.queued_jobs.forEach((queuedJob) => {
            const job = { ...queuedJob }

            if (
                jobs.length &&
                jobs[jobs.length - 1].filename === job.filename &&
                jobs[jobs.length - 1].plate === job.plate
            ) {
                jobs[jobs.length - 1].combinedIds?.push(job.job_id)
                return
            }

            const file = rootGetters['files/getFile']('gcodes/' + job.filename)
            if (!file?.metadataPulled)
                Vue.$socket.emit('server.files.metadata', { filename: job.filename }, { action: 'files/getMetadata' })

            if (file && job.plate !== null && job.plate !== undefined && Array.isArray(file.plates)) {
                const plate = file.plates.find((entry: FileStateThreeMfPlate) => entry.index === job.plate)
                if (plate) {
                    job.plate_name = plate.name
                    job.metadata = {
                        ...file,
                        ...plate,
                        filename: file.filename,
                        thumbnails: plate.thumbnails,
                        estimated_time: plate.prediction ?? undefined,
                        filament_weight_total: plate.weight ?? undefined,
                        filament_weights: plate.filament_weights,
                        filament_type: plate.filament_type?.join(', '),
                        filament_colors: plate.filament_colors,
                        referenced_tools: plate.referenced_tools,
                    }
                } else {
                    job.metadata = file
                }
            } else {
                job.metadata = file
            }
            job.combinedIds = []

            jobs.push(job)
        })

        return jobs
    },

    getJobsCount: (state) => {
        return state.queued_jobs.length
    },
}
