import { CancelTokenSource } from 'axios'

export interface FileState {
    filetree: FileStateFile[]
    upload: {
        show: boolean
        filename: string
        currentNumber: number
        maxNumber: number
        cancelTokenSource: CancelTokenSource | null
        percent: number
        speed: number
    }
}

export interface FileStateThreeMfWarning {
    message: string
    level?: number | null
    code?: string | null
}

export interface FileStateThreeMfPlate {
    index: number
    name: string
    gcode_filename?: string | null
    gcode_size?: number
    gcode_md5?: string | null
    prediction?: number | null
    weight?: number | null
    first_layer_time?: number | null
    filament_type?: string[]
    filament_colors?: string[]
    filament_names?: string[]
    filament_weights?: number[]
    referenced_tools?: number[]
    object_count?: number
    support_used?: boolean
    is_seq_print?: boolean
    bed_type?: string | null
    locked?: boolean
    printable?: boolean
    warnings?: FileStateThreeMfWarning[]
    thumbnails?: FileStateFileThumbnail[]
}

export interface FileStateFile {
    isDirectory: boolean
    filename: string
    modified: Date
    permissions: string
    childrens?: FileStateFile[]
    disk_usage?: FileStateDiskUsage
    print_start_time?: Date | null
    uuid?: string | null
    job_id?: string | null
    estimated_time?: number
    extruder_colors?: string[]
    filament_change_count?: number
    filament_colors?: string[]
    filament_name?: string
    filament_temps?: number[]
    filament_total?: number
    filament_type?: string
    filament_weight_total?: number
    filament_weights?: number[]
    first_layer_height?: number
    first_layer_bed_temp?: number
    first_layer_extr_temp?: number
    gcode_start_byte?: number
    gcode_end_byte?: number
    layer_height?: number
    mmu_print?: number
    object_height?: number
    referenced_tools?: number[]
    slicer?: string
    slicer_version?: string
    thumbnails?: FileStateFileThumbnail[]
    is_3mf?: boolean
    sliced?: boolean
    plate_count?: number
    plates?: FileStateThreeMfPlate[]
    metadataPulled?: boolean
    metadataRequested?: boolean
    size?: number
    [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface FileStateGcodefile extends FileStateFile {
    full_filename: string
    preheat_gcode: string | null
    count_printed: number
    last_end_time: Date | null
    last_filament_used: number | null
    last_print_duration: number | null
    last_status: string | null
    last_start_time: Date | null
    last_total_duration: number | null
    [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface FileStateGcodefileFilament {
    color: string
    name: string
    type: string
    weight: number
}

export interface FileStateDiskUsage {
    free: number
    total: number
    used: number
}

export interface FileStateRootInfo {
    name: string
    permissions: string
}

export interface FileStateFileThumbnail {
    width: number
    height: number
    size: number
    relative_path: string
    plate?: number
    type?: string
}

export interface ApiGetDirectoryReturn {
    dirs: ApiGetDirectoryReturnDir[]
    files: ApiGetDirectoryReturnFile[]
    disk_usage: FileStateDiskUsage
    root_info?: FileStateRootInfo
    requestParams?: Record<string, unknown>
}

export interface ApiGetDirectoryReturnDir {
    modified: number
    size: number
    dirname: string
    permissions: string
}

export interface ApiGetDirectoryReturnFile {
    modified: number
    size: number
    filename: string
    permissions: string
}

export interface ConfigFileKey {
    name: string
    type: string
    line: number
}

export interface ConfigFileSection extends ConfigFileKey {
    children: ConfigFileKey[]
}
