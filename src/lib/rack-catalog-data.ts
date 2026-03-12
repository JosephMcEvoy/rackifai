import rackData from "./netbox-rack-catalog.json"

export interface CatalogRackType {
  manufacturer: string
  model: string
  slug: string
  formFactor: string | null
  uHeight: number
  width: number | null
  outerWidth: number | null
  outerHeight: number | null
  outerDepth: number | null
  outerDimensionUnit: string | null
  weight: number | null
  maxWeight: number | null
  weightUnit: string | null
  mountingDepth: number | null
  startingUnit: number
  description: string | null
}

interface RawRackType {
  manufacturer: string
  model: string
  slug: string
  formFactor: string | null
  uHeight: number
  width: number | null
  outerWidth: number | null
  outerHeight: number | null
  outerDepth: number | null
  outerDimensionUnit: string | null
  weight: number | null
  maxWeight: number | null
  weightUnit: string | null
  mountingDepth: number | null
  startingUnit: number
  description: string | null
}

const _rackCatalog: CatalogRackType[] = (rackData.rackTypes as RawRackType[]).map((r) => ({
  ...r,
}))

export function getRackCatalogTypes(): CatalogRackType[] {
  return _rackCatalog
}
