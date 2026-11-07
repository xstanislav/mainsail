import { describe, expect, it } from 'vitest'
import { gcodeFileExtension, isGcodeFile, isMultiPlateFile, multiPlateExtension } from '@/store/variables'

describe('gcode file extensions', () => {
    it('detects multi-plate 3MF projects', () => {
        expect(isMultiPlateFile('part.gcode.3mf')).toBe(true)
        expect(isMultiPlateFile('PART.GCODE.3MF')).toBe(true)
        expect(isMultiPlateFile('part.3mf')).toBe(false)
        expect(isMultiPlateFile('part.gcode')).toBe(false)
    })

    it('detects printable gcode files', () => {
        expect(isGcodeFile('part.gcode')).toBe(true)
        expect(isGcodeFile('part.G')).toBe(true)
        expect(isGcodeFile('part.gcode.3mf')).toBe(true)
        expect(isGcodeFile('part.3mf')).toBe(false)
        expect(isGcodeFile('part.txt')).toBe(false)
        expect(isGcodeFile('part')).toBe(false)
    })

    it('returns the compound extension for 3MF projects', () => {
        expect(gcodeFileExtension('part.gcode.3mf')).toBe(multiPlateExtension)
        expect(gcodeFileExtension('part.GCODE.3MF')).toBe(multiPlateExtension)
        expect(gcodeFileExtension('part.gcode')).toBe('.gcode')
    })
})
