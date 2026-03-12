import moduleData from "./netbox-module-catalog.json"

export interface CatalogModuleType {
  manufacturer: string
  model: string
  slug: string
  partNumber: string | null
  weightKg: number | null
  description: string | null
  interfaceCount: number
  consolePortCount: number
  powerPortCount: number
  moduleBayCount: number
}

interface RawModuleType {
  manufacturer: string
  model: string
  slug: string
  partNumber: string | null
  weightKg: number | null
  description: string | null
  interfaceCount: number
  consolePortCount: number
  powerPortCount: number
  moduleBayCount: number
}

const _moduleCatalog: CatalogModuleType[] = (moduleData.moduleTypes as RawModuleType[]).map((m) => ({
  ...m,
}))

export function getModuleCatalogTypes(): CatalogModuleType[] {
  return _moduleCatalog
}
