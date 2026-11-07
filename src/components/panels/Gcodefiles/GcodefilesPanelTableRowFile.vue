<template>
    <tr
        v-longpress:600="showContextMenuAction"
        class="file-list-cursor user-select-none"
        draggable="true"
        @click="clickOnRow"
        @contextmenu="showContextMenuAction($event)"
        @dragstart="onDragStart"
        @drag="onDrag">
        <td class="file-list__select-td pr-0">
            <v-simple-checkbox v-ripple :value="isSelected" class="pa-0 mr-0" @click.stop="select(!isSelected)" />
        </td>
        <td class="px-0 text-center" style="width: 32px">
            <gcodefiles-thumbnail :item="item" />
        </td>
        <td class=" ">
            {{ item.filename }}
            <v-chip v-if="multiPlate && plateCount > 1" x-small class="ml-2">
                {{ $t('Files.PlateCount', { count: plateCount }) }}
            </v-chip>
        </td>
        <td class="text-right text-no-wrap">
            <v-tooltip v-if="item.last_status" top>
                <template #activator="{ on, attrs }">
                    <span v-bind="attrs" v-on="on">
                        <span v-if="item.count_printed > 0" :class="`file-list__count_printed ${printStatusTextColor}`">
                            {{ item.count_printed }}
                        </span>
                        <v-icon small :color="printStatusIconColor">{{ printStatusIcon }}</v-icon>
                    </span>
                </template>
                <span>{{ item.last_status.replace(/_/g, ' ') }}</span>
            </v-tooltip>
        </td>
        <template v-for="col in tableColumns">
            <gcodefiles-panel-table-row-file-metadata-slicer
                v-if="col.value === 'slicer'"
                :key="col.value"
                :item="item" />
            <gcodefiles-panel-table-row-file-metadata-filaments
                v-else-if="col.value === 'filaments'"
                :key="col.value"
                :item="item" />
            <gcodefiles-panel-table-row-file-metadata-filament-strings
                v-else-if="['filament_name', 'filament_type'].includes(col.value)"
                :key="col.value"
                :item="item"
                :column="col.value" />
            <gcodefiles-panel-table-row-file-metadata v-else :key="col.value" :col="col" :item="item" />
        </template>
        <v-menu
            v-model="showContextMenu"
            :position-x="showContextMenuX"
            :position-y="showContextMenuY"
            absolute
            offset-y>
            <v-list>
                <v-list-item
                    v-if="isGcodeFile"
                    :disabled="!klipperReadyForGui || ['error', 'printing', 'paused'].includes(printer_state)"
                    @click="openPrintDialog">
                    <v-icon class="mr-1">{{ mdiPlay }}</v-icon>
                    {{ $t('Files.PrintStart') }}
                </v-list-item>
                <v-list-item
                    v-if="moonrakerComponents.includes('job_queue')"
                    :disabled="!isGcodeFile"
                    @click="openQueueDialog">
                    <v-icon class="mr-1">{{ mdiPlaylistPlus }}</v-icon>
                    {{ $t('Files.AddToQueue') }}
                </v-list-item>
                <v-list-item
                    v-if="moonrakerComponents.includes('job_queue')"
                    :disabled="!isGcodeFile || multiPlate"
                    @click="showAddBatchToQueueDialog = true">
                    <v-icon class="mr-1">{{ mdiPlaylistPlus }}</v-icon>
                    {{ $t('Files.AddBatchToQueue') }}
                </v-list-item>
                <v-list-item
                    v-if="item.preheat_gcode !== null"
                    :disabled="['error', 'printing', 'paused'].includes(printer_state)"
                    @click="doSend(item.preheat_gcode)">
                    <v-icon class="mr-1">{{ mdiFire }}</v-icon>
                    {{ $t('Files.Preheat') }}
                </v-list-item>
                <v-list-item :disabled="!isGcodeFile" @click="openViewDialog">
                    <v-icon class="mr-1">{{ mdiVideo3d }}</v-icon>
                    {{ $t('Files.View3D') }}
                </v-list-item>
                <v-list-item :disabled="!isGcodeFile" @click="scanMeta">
                    <v-icon class="mr-1">{{ mdiMagnify }}</v-icon>
                    {{ $t('Files.ScanMeta') }}
                </v-list-item>
                <v-list-item @click="downloadFile">
                    <v-icon class="mr-1">{{ mdiCloudDownload }}</v-icon>
                    {{ $t('Files.Download') }}
                </v-list-item>
                <v-list-item :disabled="multiPlate" @click="editFile">
                    <v-icon class="mr-1">{{ mdiFileDocumentEditOutline }}</v-icon>
                    {{ $t('Files.EditFile') }}
                </v-list-item>
                <v-list-item @click="showRenameFileDialog = true">
                    <v-icon class="mr-1">{{ mdiRenameBox }}</v-icon>
                    {{ $t('Files.Rename') }}
                </v-list-item>
                <v-list-item @click="showDuplicateFileDialog = true">
                    <v-icon class="mr-1">{{ mdiContentCopy }}</v-icon>
                    {{ $t('Files.Duplicate') }}
                </v-list-item>
                <v-list-item class="red--text" @click="showDeleteFileDialog = true">
                    <v-icon class="mr-1" color="error">{{ mdiDelete }}</v-icon>
                    {{ $t('Files.Delete') }}
                </v-list-item>
            </v-list>
        </v-menu>
        <start-print-dialog
            v-model="showStartPrintDialog"
            :file="printFile"
            :current-path="currentPath"
            :plate="selectedPlate?.index ?? null" />
        <gcodefiles-three-mf-plate-dialog
            v-model="showPlateDialog"
            :item="item"
            :mode="plateDialogMode"
            @print="startThreeMfPrint"
            @queue="queueThreeMfPlate"
            @view="viewThreeMfPlate" />
        <add-batch-to-queue-dialog v-model="showAddBatchToQueueDialog" :filename="item.full_filename" />
        <gcodefiles-rename-file-dialog v-model="showRenameFileDialog" :item="item" />
        <gcodefiles-duplicate-file-dialog v-model="showDuplicateFileDialog" :item="item" />
        <confirmation-dialog
            v-model="showDeleteFileDialog"
            :title="$t('Files.Delete')"
            :text="$t('Files.DeleteSingleFileQuestion', { name: item.filename })"
            :action-button-text="$t('Buttons.Delete')"
            @action="deleteFile" />
    </tr>
</template>
<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import type { LongpressEvent } from '@/directives/longpress'
import BaseMixin from '@/components/mixins/base'
import GcodefilesMixin from '@/components/mixins/gcodefiles'
import { FileStateGcodefile, FileStateThreeMfPlate } from '@/store/files/types'
import { isGcodeFile as isGcodeFilename, isMultiPlateFile } from '@/store/variables'
import GcodefilesThumbnail from '@/components/panels/Gcodefiles/GcodefilesThumbnail.vue'
import {
    mdiCloudDownload,
    mdiContentCopy,
    mdiDelete,
    mdiFileDocumentEditOutline,
    mdiFire,
    mdiMagnify,
    mdiPlay,
    mdiPlaylistPlus,
    mdiRenameBox,
    mdiVideo3d,
} from '@mdi/js'
import ControlMixin from '@/components/mixins/control'
import { convertPrintStatusIcon, convertPrintStatusIconColor, escapePath } from '@/plugins/helpers'
import GcodefilesRenameFileDialog from '@/components/dialogs/GcodefilesRenameFileDialog.vue'
import GcodefilesDuplicateFileDialog from '@/components/dialogs/GcodefilesDuplicateFileDialog.vue'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog.vue'
import GcodefilesPanelTableRowFileMetadata from '@/components/panels/Gcodefiles/GcodefilesPanelTableRowFileMetadata.vue'
import GcodefilesPanelTableRowFileMetadataFilaments from '@/components/panels/Gcodefiles/GcodefilesPanelTableRowFileMetadataFilaments.vue'
import GcodefilesPanelTableRowFileMetadataSlicer from '@/components/panels/Gcodefiles/GcodefilesPanelTableRowFileMetadataSlicer.vue'
import GcodefilesPanelTableRowFileMetadataFilamentStrings from '@/components/panels/Gcodefiles/GcodefilesPanelTableRowFileMetadataFilamentStrings.vue'
import GcodefilesThreeMfPlateDialog from '@/components/dialogs/GcodefilesThreeMfPlateDialog.vue'
import { CLOSE_CONTEXT_MENU, EventBus } from '@/plugins/eventBus'
import axios from 'axios'

@Component({
    components: {
        ConfirmationDialog,
        GcodefilesPanelTableRowFileMetadataFilamentStrings,
        GcodefilesPanelTableRowFileMetadataFilaments,
        GcodefilesPanelTableRowFileMetadataSlicer,
        GcodefilesPanelTableRowFileMetadata,
        GcodefilesDuplicateFileDialog,
        GcodefilesRenameFileDialog,
        GcodefilesThreeMfPlateDialog,
        GcodefilesThumbnail,
    },
})
export default class GcodefilesPanelTableRowFile extends Mixins(BaseMixin, ControlMixin, GcodefilesMixin) {
    mdiCloudDownload = mdiCloudDownload
    mdiContentCopy = mdiContentCopy
    mdiDelete = mdiDelete
    mdiFileDocumentEditOutline = mdiFileDocumentEditOutline
    mdiFire = mdiFire
    mdiMagnify = mdiMagnify
    mdiPlay = mdiPlay
    mdiPlaylistPlus = mdiPlaylistPlus
    mdiRenameBox = mdiRenameBox
    mdiVideo3d = mdiVideo3d

    showContextMenu = false
    showContextMenuX = 0
    showContextMenuY = 0

    showStartPrintDialog = false
    showAddBatchToQueueDialog = false
    showPlateDialog = false
    plateDialogMode: 'print' | 'queue' | 'view' = 'print'
    selectedPlate: FileStateThreeMfPlate | null = null
    showRenameFileDialog = false
    showDuplicateFileDialog = false
    showDeleteFileDialog = false

    @Prop({ type: Object, required: true }) readonly item!: FileStateGcodefile
    @Prop({ type: Boolean, required: true }) readonly isSelected!: boolean
    @Prop({ type: Function, required: true }) readonly select!: (value: boolean) => void

    get isGcodeFile() {
        return isGcodeFilename(this.item.filename)
    }

    get multiPlate() {
        return isMultiPlateFile(this.item.filename)
    }

    get plateCount() {
        return this.item.plate_count ?? this.item.plates?.length ?? 0
    }

    get printFile(): FileStateGcodefile {
        if (!this.selectedPlate) return this.item

        return {
            ...this.item,
            thumbnails: this.selectedPlate.thumbnails ?? this.item.thumbnails,
            estimated_time: this.selectedPlate.prediction ?? this.item.estimated_time,
            filament_weight_total: this.selectedPlate.weight ?? this.item.filament_weight_total,
            filament_weights: this.selectedPlate.filament_weights,
            filament_type: this.selectedPlate.filament_type?.join(', ') ?? this.item.filament_type,
            filament_colors: this.selectedPlate.filament_colors ?? this.item.filament_colors,
            referenced_tools: this.selectedPlate.referenced_tools ?? this.item.referenced_tools,
        }
    }

    get printStatusTextColor() {
        switch (this.item.last_status) {
            case 'in_progress':
                return 'blue--text' //'blue-grey darken-1'
            case 'completed':
                return 'green--text' //'green'
            case 'cancelled':
                return 'red--text'

            default:
                return 'orange--text'
        }
    }

    get printStatusIcon() {
        return convertPrintStatusIcon(this.item.last_status ?? '')
    }

    get printStatusIconColor() {
        return convertPrintStatusIconColor(this.item.last_status ?? '')
    }

    showContextMenuAction(e: MouseEvent | LongpressEvent) {
        e?.preventDefault()
        EventBus.$emit(CLOSE_CONTEXT_MENU)

        this.showContextMenuX = e?.clientX || e?.pageX || window.screenX / 2
        this.showContextMenuY = e?.clientY || e?.pageY || window.screenY / 2

        this.showContextMenu = true
    }

    closeContextMenu() {
        this.showContextMenu = false
    }

    clickOnRow() {
        if (!this.isGcodeFile || ['error', 'printing', 'paused'].includes(this.printer_state)) return

        this.openPrintDialog()
    }

    openPrintDialog() {
        if (this.multiPlate) {
            this.plateDialogMode = 'print'
            this.showPlateDialog = true
            return
        }

        this.selectedPlate = null
        this.showStartPrintDialog = true
    }

    openQueueDialog() {
        if (this.multiPlate) {
            this.plateDialogMode = 'queue'
            this.showPlateDialog = true
            return
        }

        this.addToQueue()
    }

    openViewDialog() {
        if (this.multiPlate) {
            this.plateDialogMode = 'view'
            this.showPlateDialog = true
            return
        }

        this.view3D()
    }

    startThreeMfPrint(plate: FileStateThreeMfPlate) {
        this.selectedPlate = plate
        this.showPlateDialog = false
        this.showStartPrintDialog = true
    }

    queueThreeMfPlate(plate: FileStateThreeMfPlate) {
        let filename = this.item.full_filename || [this.currentPath, this.item.filename].join('/')
        filename = filename.replace(/^\/+/, '')

        this.$store.dispatch('server/jobQueue/addToQueue', [{ filename, plate: plate.index }])
        this.showPlateDialog = false
    }

    async viewThreeMfPlate(plate: FileStateThreeMfPlate) {
        let filename = this.item.full_filename || [this.currentPath, this.item.filename].join('/')
        filename = filename.replace(/^\/+/, '')

        try {
            const response = await axios.post(this.apiUrl + '/server/files/extract_plate', {
                filename,
                plate: plate.index,
            })
            const extracted = response.data?.result?.item?.path
            if (!extracted) throw new Error('No plate path returned')

            this.$router.push({
                path: '/viewer',
                query: {
                    filename: 'gcodes/' + extracted,
                    source: filename,
                    plate: plate.index.toString(),
                },
            })
        } catch (error) {
            window.console.error(error)
            this.$toast.error(this.$t('Files.ExtractPlateFailed').toString())
        } finally {
            this.showPlateDialog = false
        }
    }

    addToQueue() {
        let filename = [this.currentPath, this.item.filename].join('/')
        if (filename.startsWith('/')) filename = filename.slice(1)

        this.$store.dispatch('server/jobQueue/addToQueue', [filename])
    }

    view3D() {
        this.$router.push({
            path: '/viewer',
            query: { filename: 'gcodes' + this.currentPath + '/' + this.item.filename },
        })
    }

    scanMeta() {
        this.$store.dispatch('files/scanMetadata', {
            filename: 'gcodes' + this.currentPath + '/' + this.item.filename,
        })
    }

    downloadFile() {
        const filename = this.currentPath + '/' + this.item.filename
        const href = this.apiUrl + '/server/files/gcodes' + escapePath(filename)

        window.open(href)
    }

    editFile() {
        this.$store.dispatch('editor/openFile', {
            root: 'gcodes',
            path: this.currentPath,
            filename: this.item.filename,
            size: this.item.size,
            permissions: this.item.permissions,
        })
    }

    deleteFile() {
        this.$socket.emit(
            'server.files.delete_file',
            { path: 'gcodes' + this.currentPath + '/' + this.item.filename },
            { action: 'files/getDeleteFile' }
        )
    }

    onDragStart(e: DragEvent) {
        if (e.dataTransfer === null) return

        e.dataTransfer.setData('filename', this.item.filename)
        e.dataTransfer.effectAllowed = 'move'
    }

    onDrag(e: DragEvent) {
        e.preventDefault()
        e.stopPropagation()
    }

    mounted() {
        EventBus.$on(CLOSE_CONTEXT_MENU, this.closeContextMenu)
    }

    beforeDestroy() {
        EventBus.$off(CLOSE_CONTEXT_MENU, this.closeContextMenu)
    }
}
</script>

<style scoped>
.file-list__count_printed {
    position: relative;
    top: 1px;
}
</style>
