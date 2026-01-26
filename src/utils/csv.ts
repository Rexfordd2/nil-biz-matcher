import Papa, { type ParseResult } from 'papaparse'

export type CsvParseResult = {
  rows: Record<string, string>[]
  errors: string[]
  fields: string[]
}

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => (h || '').trim(),
      transform: (val: unknown) => (typeof val === 'string' ? val.trim() : val),
      complete: (result: ParseResult<Record<string, string>>, _file: any) => {
        const rows = (result.data || []).filter(Boolean) as Record<string, string>[]
        const errors: string[] = (result.errors || []).map((e) => `Row ${typeof e.row === 'number' ? e.row : '?'}: ${e.message}`)
        const fields = (result.meta?.fields || []).map((f) => f || '')
        resolve({ rows, errors, fields })
      }
    })
  })
}


