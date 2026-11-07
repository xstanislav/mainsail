import Vue from 'vue'
import { ActionTree } from 'vuex'
import { RootState } from '@/store/types'
import { ServerJobQueueState, ServerJobQueueStateJob } from '@/store/server/jobQueue/types'

export const actions: ActionTree<ServerJobQueueState, RootState> = {
    reset({ commit }) {
        commit('reset')
    },

    init() {
        Vue.$socket.emit('server.job_queue.status', {}, { action: 'server/jobQueue/getStatus' })
    },

    getEvent({ commit }, payload) {
        if ('updated_queue' in payload && payload.updated_queue !== null) commit('setQueuedJobs', payload.updated_queue)
        if ('queue_state' in payload) commit('setQueueState', payload.queue_state)
    },

    async getStatus({ commit, dispatch }, payload) {
        if ('queued_jobs' in payload) commit('setQueuedJobs', payload.queued_jobs)
        if ('queue_state' in payload) commit('setQueueState', payload.queue_state)

        await dispatch('socket/removeInitModule', 'server/jobQueue/init', { root: true })
    },

    async addToQueue(_, files: Array<string | { filename: string; plate?: number }>) {
        const jobs = files.map((file) => (typeof file === 'string' ? { filename: file } : file))
        const hasPlate = jobs.some((job) => job.plate !== undefined)

        if (hasPlate) {
            Vue.$socket.emit('server.job_queue.post_job', { jobs })
            return
        }

        Vue.$socket.emit('server.job_queue.post_job', { filenames: jobs.map((job) => job.filename) })
    },

    changeCount({ dispatch, getters }, payload: { job_id: string; count: number }) {
        const jobs: ServerJobQueueStateJob[] = getters['getJobs']

        const index = jobs.findIndex((job) => job.job_id === payload.job_id)
        if (index === -1) return

        jobs[index].combinedIds = Array(payload.count - 1).fill(payload.job_id)

        dispatch('sendNewQueueList', { jobs })
    },

    changePosition({ dispatch, getters }, payload: { oldIndex: number; newIndex: number }) {
        const jobs: ServerJobQueueStateJob[] = getters['getJobs']

        const job = jobs.splice(payload.oldIndex, 1)[0]
        jobs.splice(payload.newIndex, 0, job)

        dispatch('sendNewQueueList', { jobs })
    },

    startByJobId({ dispatch, getters }, job_id: string) {
        const jobs: ServerJobQueueStateJob[] = getters['getJobs']

        const index = jobs.findIndex((job) => job.job_id === job_id)
        if (index === -1) return

        const job = jobs.splice(index, 1)[0]
        jobs.splice(0, 0, job)

        dispatch('sendNewQueueList', { jobs, printStart: true })
    },

    sendNewQueueList(_, payload: { jobs: ServerJobQueueStateJob[]; printStart?: boolean }) {
        const jobs = payload.jobs
            .map((job) => {
                const numJobs = (job.combinedIds?.length ?? 0) + 1
                return Array.from({ length: numJobs }, () => ({
                    filename: job.filename,
                    ...(job.plate !== null && job.plate !== undefined ? { plate: job.plate } : {}),
                }))
            })
            .flat()

        const emitOptions: { action?: string } = {}
        if (payload.printStart) emitOptions.action = 'server/jobQueue/start'

        const hasPlate = jobs.some((job) => job.plate !== undefined)
        const body = hasPlate ? { jobs, reset: true } : { filenames: jobs.map((job) => job.filename), reset: true }

        Vue.$socket.emit('server.job_queue.post_job', body, emitOptions)
    },

    deleteFromQueue(_, job_ids: string[]) {
        Vue.$socket.emit('server.job_queue.delete_job', { job_ids })
    },

    clearQueue() {
        Vue.$socket.emit('server.job_queue.delete_job', { all: true })
    },

    start() {
        Vue.$socket.emit('server.job_queue.start', {}, { loading: 'startJobqueue' })
    },

    pause() {
        Vue.$socket.emit('server.job_queue.pause', {}, { loading: 'pauseJobqueue' })
    },
}
