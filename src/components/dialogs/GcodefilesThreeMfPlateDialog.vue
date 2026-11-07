<template>
    <v-dialog v-model="showDialog" max-width="900" scrollable @click:outside="closeDialog" @keydown.esc="closeDialog">
        <panel :title="$t('Files.SelectPlate')" card-class="gcodefiles-three-mf-dialog" :margin-bottom="false">
            <template #buttons>
                <v-btn icon tile @click="closeDialog">
                    <v-icon>{{ mdiCloseThick }}</v-icon>
                </v-btn>
            </template>

            <v-card-text v-if="!metadataLoaded" class="text-center py-8">
                <v-progress-circular indeterminate color="primary" />
                <div class="mt-4">{{ $t('Files.PlateMetadataLoading') }}</div>
            </v-card-text>

            <v-card-text v-else-if="!plates.length">
                <v-alert type="warning" text>
                    {{ $t('Files.ThreeMfNotSliced') }}
                </v-alert>
            </v-card-text>

            <v-card-text v-else>
                <v-row dense>
                    <v-col v-for="plate in plates" :key="plate.index" cols="12" sm="6" md="4">
                        <v-card
                            :class="{ 'three-mf-plate--selected': selectedIndex === plate.index }"
                            :disabled="plate.printable === false"
                            outlined
                            class="three-mf-plate"
                            @click="selectPlate(plate)">
                            <v-img
                                v-if="thumbnailUrl(plate)"
                                :src="thumbnailUrl(plate)"
                                height="160"
                                contain
                                class="three-mf-plate__image" />
                            <v-card-title class="text-subtitle-1 pb-1">
                                {{ plate.name || $t('Files.Plate', { index: plate.index }) }}
                            </v-card-title>
                            <v-card-subtitle class="pb-1">
                                {{ $t('Files.Plate', { index: plate.index }) }}
                            </v-card-subtitle>
                            <v-card-text class="pt-0">
                                <div class="d-flex justify-space-between">
                                    <span>{{ $t('Files.PrintTime') }}</span>
                                    <strong>{{ formatPrintTime(plate.prediction ?? 0) }}</strong>
                                </div>
                                <div class="d-flex justify-space-between">
                                    <span>{{ $t('Files.FilamentWeight') }}</span>
                                    <strong>{{ formatWeight(plate.weight) }}</strong>
                                </div>
                                <div v-if="plate.object_count" class="d-flex justify-space-between">
                                    <span>{{ $t('Files.Objects') }}</span>
                                    <strong>{{ plate.object_count }}</strong>
                                </div>
                                <div v-if="plate.filament_type?.length" class="d-flex align-center mt-2">
                                    <v-icon small class="mr-2">{{ mdiPalette }}</v-icon>
                                    <span class="text-truncate">{{ plate.filament_type.join(', ') }}</span>
                                </div>
                                <div v-if="plate.filament_colors?.length" class="d-flex align-center mt-2">
                                    <span
                                        v-for="color in plate.filament_colors"
                                        :key="color"
                                        :style="{ backgroundColor: color }"
                                        class="three-mf-plate__color" />
                                </div>
                                <v-chip v-if="plate.printable === false" x-small color="warning" class="mt-2">
                                    {{ $t('Files.NotPrintable') }}
                                </v-chip>
                                <v-alert
                                    v-for="(warning, index) in plate.warnings ?? []"
                                    :key="`${warning.code || warning.message}-${index}`"
                                    dense
                                    text
                                    type="warning"
                                    class="mt-2 mb-0 three-mf-plate__warning"
                                    @click.stop="toggleWarning(plate, index)">
                                    <div class="d-flex align-center">
                                        <div
                                            class="flex-grow-1 text-caption three-mf-plate__warning-text"
                                            :class="{
                                                'three-mf-plate__warning-text--collapsed': !isWarningExpanded(
                                                    plate,
                                                    index
                                                ),
                                            }"
                                            :title="warningText(warning)">
                                            {{ warningText(warning) }}
                                        </div>
                                        <v-btn
                                            icon
                                            x-small
                                            class="ml-1 flex-shrink-0"
                                            @click.stop="toggleWarning(plate, index)">
                                            <v-icon small>
                                                {{ isWarningExpanded(plate, index) ? mdiChevronUp : mdiChevronDown }}
                                            </v-icon>
                                        </v-btn>
                                    </div>
                                </v-alert>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
            </v-card-text>

            <v-divider />
            <v-card-actions>
                <v-spacer />
                <v-btn text @click="closeDialog">{{ $t('Buttons.Cancel') }}</v-btn>
                <v-btn
                    color="primary"
                    text
                    :disabled="selectedPlate === null || selectedPlate.printable === false"
                    @click="confirm">
                    {{ actionLabel }}
                </v-btn>
            </v-card-actions>
        </panel>
    </v-dialog>
</template>

<script lang="ts">
import { Component, Mixins, Prop, VModel, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import GcodefilesMixin from '@/components/mixins/gcodefiles'
import Panel from '@/components/ui/Panel.vue'
import {
    FileStateFileThumbnail,
    FileStateGcodefile,
    FileStateThreeMfPlate,
    FileStateThreeMfWarning,
} from '@/store/files/types'
import { escapePath, filamentWeightFormat, formatPrintTime } from '@/plugins/helpers'
import { mdiChevronDown, mdiChevronUp, mdiCloseThick, mdiPalette } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class GcodefilesThreeMfPlateDialog extends Mixins(BaseMixin, GcodefilesMixin) {
    mdiCloseThick = mdiCloseThick
    mdiChevronDown = mdiChevronDown
    mdiChevronUp = mdiChevronUp
    mdiPalette = mdiPalette

    @VModel({ type: Boolean }) showDialog!: boolean
    @Prop({ type: Object, required: true }) readonly item!: FileStateGcodefile
    @Prop({ type: String, default: 'print' }) readonly mode!: 'print' | 'queue' | 'view'

    selectedIndex: number | null = null
    expandedWarnings: Record<string, boolean> = {}

    get metadataLoaded() {
        return this.item.metadataPulled === true
    }

    get plates(): FileStateThreeMfPlate[] {
        return this.item.plates ?? []
    }

    get selectedPlate(): FileStateThreeMfPlate | null {
        if (this.selectedIndex === null) return null

        return this.plates.find((plate) => plate.index === this.selectedIndex) ?? null
    }

    get fullFilename() {
        let filename = this.item.full_filename || [this.currentPath, this.item.filename].join('/')
        filename = filename.replace(/^\/+/, '')

        return filename
    }

    get actionLabel() {
        switch (this.mode) {
            case 'queue':
                return this.$t('Files.AddPlateToQueue').toString()
            case 'view':
                return this.$t('Files.ViewPlate3D').toString()
            default:
                return this.$t('Files.PrintPlate').toString()
        }
    }

    selectPlate(plate: FileStateThreeMfPlate) {
        if (plate.printable === false) return

        this.selectedIndex = plate.index
    }

    thumbnailUrl(plate: FileStateThreeMfPlate): string | null {
        const thumbnails = plate.thumbnails ?? []
        const thumbnail =
            thumbnails.find((thumb) => thumb.type === 'thumbnail' && thumb.width >= 256) ??
            thumbnails.find((thumb) => thumb.type === 'thumbnail' && thumb.width >= 128) ??
            thumbnails.find((thumb) => thumb.type === 'thumbnail')

        return this.buildThumbnailUrl(thumbnail)
    }

    buildThumbnailUrl(thumbnail: FileStateFileThumbnail | undefined): string | null {
        if (!thumbnail?.relative_path) return null

        const pathParts = [this.apiUrl, 'server/files/gcodes']
        const fullFilename = this.fullFilename
        const lastSlash = fullFilename.lastIndexOf('/')
        const directory = lastSlash >= 0 ? fullFilename.slice(0, lastSlash) : ''
        if (directory) pathParts.push(escapePath(directory))
        pathParts.push(escapePath(thumbnail.relative_path))

        const timestamp = typeof this.item.modified?.getTime === 'function' ? this.item.modified.getTime() : 0

        return `${pathParts.join('/')}?timestamp=${timestamp}`
    }

    formatPrintTime = formatPrintTime

    formatWeight(weight: number | null | undefined): string {
        if (!weight) return '--'

        return filamentWeightFormat(weight)
    }

    // IDs and texts mirror OrcaSlicer's Plater::get_slice_warning_string()
    // and localization/i18n/<lang>/OrcaSlicer_<lang>.po.
    warningText(warning: FileStateThreeMfWarning): string {
        if (warning.code) {
            const codeKey = `Files.ThreeMfWarnings.${warning.message}_${warning.code}`
            if (this.$te(codeKey)) return this.$t(codeKey).toString()
        }

        const key = `Files.ThreeMfWarnings.${warning.message}`
        if (this.$te(key)) return this.$t(key).toString()

        const text = warning.message.replace(/_/g, ' ').trim()

        return text.charAt(0).toUpperCase() + text.slice(1)
    }

    warningKey(plate: FileStateThreeMfPlate, index: number): string {
        return `${plate.index}:${index}`
    }

    isWarningExpanded(plate: FileStateThreeMfPlate, index: number): boolean {
        return this.expandedWarnings[this.warningKey(plate, index)] === true
    }

    toggleWarning(plate: FileStateThreeMfPlate, index: number) {
        const key = this.warningKey(plate, index)

        this.$set(this.expandedWarnings, key, !this.isWarningExpanded(plate, index))
    }

    confirm() {
        if (this.selectedPlate === null) return

        switch (this.mode) {
            case 'queue':
                this.$emit('queue', this.selectedPlate)
                break
            case 'view':
                this.$emit('view', this.selectedPlate)
                break
            default:
                this.$emit('print', this.selectedPlate)
        }
    }

    closeDialog() {
        this.showDialog = false
    }

    @Watch('showDialog')
    onShowDialogChanged(newVal: boolean) {
        if (!newVal) return

        this.expandedWarnings = {}
        this.selectedIndex = this.plates.find((plate) => plate.printable !== false)?.index ?? null

        if (this.item.metadataPulled || this.item.metadataRequested) return

        this.$store.dispatch('files/requestMetadata', [{ filename: 'gcodes/' + this.fullFilename }])
    }

    @Watch('item.plates')
    onPlatesChanged() {
        if (!this.showDialog || this.selectedIndex !== null) return

        this.selectedIndex = this.plates.find((plate) => plate.printable !== false)?.index ?? null
    }
}
</script>

<style scoped>
.three-mf-plate {
    cursor: pointer;
    transition:
        border-color 150ms ease-in-out,
        box-shadow 150ms ease-in-out;
}

.three-mf-plate--selected {
    border-color: var(--v-primary-base);
    box-shadow: 0 0 0 1px var(--v-primary-base);
}

.three-mf-plate__image {
    background-color: rgba(255, 255, 255, 0.04);
}

.three-mf-plate__warning {
    cursor: pointer;
    overflow: hidden;
}

.three-mf-plate__warning ::v-deep .v-alert__content {
    min-width: 0;
}

.three-mf-plate__warning .d-flex {
    min-width: 0;
}

.three-mf-plate__warning-text {
    min-width: 0;
}

.three-mf-plate__warning-text--collapsed {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.three-mf-plate__color {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.35);
    margin-right: 6px;
}
</style>
