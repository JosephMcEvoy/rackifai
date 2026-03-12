/**
 * Import script for NetBox community DeviceType library.
 *
 * Usage:
 *   1. Clone: git clone --depth 1 https://github.com/netbox-community/devicetype-library /tmp/devicetype-library
 *   2. Run:   npx tsx scripts/import-netbox-catalog.ts /tmp/devicetype-library
 *
 * Accepts repo root or the legacy device-types/ subdir path (backward-compatible).
 *
 * Outputs:
 *   - src/lib/netbox-catalog.json        (device types)
 *   - src/lib/netbox-rack-catalog.json    (rack types)
 *   - src/lib/netbox-module-catalog.json  (module types)
 *
 * The GitHub Actions workflow runs this weekly to keep the catalogs fresh.
 */

import { readdir, readFile, writeFile, stat } from "node:fs/promises"
import { join, basename, extname } from "node:path"
import { parse } from "yaml"

// --- Resolve repo root ---

function resolveRepoRoot(arg: string): string {
  // Strip trailing /device-types or \device-types for backward compatibility
  return arg.replace(/[/\\]device-types\/?$/, "")
}

// --- NetBox YAML schemas ---

interface NetBoxPowerPort {
  name?: string
  maximum_draw?: number
  allocated_draw?: number
}

interface NetBoxDeviceType {
  manufacturer: string
  model: string
  slug?: string
  part_number?: string
  u_height?: number
  is_full_depth?: boolean
  weight?: number
  weight_unit?: "kg" | "lb"
  airflow?: string
  front_image?: boolean
  rear_image?: boolean
  "power-ports"?: NetBoxPowerPort[]
}

interface NetBoxRackType {
  manufacturer: string
  model: string
  slug?: string
  form_factor?: string
  u_height?: number
  width?: number
  outer_width?: number
  outer_height?: number
  outer_depth?: number
  outer_unit?: string
  weight?: number
  max_weight?: number
  weight_unit?: string
  mounting_depth?: number
  starting_unit?: number
  description?: string
}

interface NetBoxModuleType {
  manufacturer: string
  model: string
  slug?: string
  part_number?: string
  weight?: number
  weight_unit?: "kg" | "lb"
  description?: string
  interfaces?: unknown[]
  "console-ports"?: unknown[]
  "power-ports"?: unknown[]
  "module-bays"?: unknown[]
}

// --- Output schemas ---

interface DeviceCatalogEntry {
  manufacturer: string
  model: string
  slug: string
  uHeight: number
  isFullDepth: boolean
  weightKg: number | null
  maxPowerWatts: number | null
  category: string
  frontImageUrl: string | null
  rearImageUrl: string | null
}

interface RackCatalogEntry {
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

interface ModuleCatalogEntry {
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

// --- Category inference ---

const CATEGORY_RULES: [RegExp, string][] = [
  [/\b(patch[- ]?panel|fiber[- ]?panel)\b/i, "patch_panel"],
  [/\b(pdu|power[- ]?distribut)/i, "pdu"],
  [/\b(ups|uninterruptible|smart-ups|eaton.*5p|apc.*s[rm]t)\b/i, "ups"],
  [/\b(switch|nexus|catalyst|arista|ex\d{4}|qfx|sg\d{3}|gs\d{3}|icx|procurve)\b/i, "switch"],
  [/\b(patch|panel)\b/i, "patch_panel"],
  [/\b(storage|disk[- ]?shelf|nas\b|san\b|unity|netapp|pure|nimble|equallogic|compellent|md\d{4}|powervault|readynas)\b/i, "storage"],
  [/\b(blank|filler|spacer)\b/i, "blank"],
]

function inferCategory(slug: string, model: string, manufacturer: string): string {
  const s = `${slug} ${model} ${manufacturer}`
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(s)) return category
  }
  return "server"
}

// --- Helpers ---

function toKg(weight: number | undefined, unit: string | undefined): number | null {
  if (weight == null) return null
  if (unit === "lb") return Math.round(weight * 0.453592 * 100) / 100
  return weight
}

function extractMaxPower(powerPorts: NetBoxPowerPort[] | undefined): number | null {
  if (!powerPorts || powerPorts.length === 0) return null
  let max = 0
  for (const port of powerPorts) {
    if (port.maximum_draw != null && port.maximum_draw > max) {
      max = port.maximum_draw
    }
  }
  if (max === 0) {
    let total = 0
    for (const port of powerPorts) {
      if (port.allocated_draw != null) total += port.allocated_draw
    }
    if (total > 0) return total
  }
  return max > 0 ? max : null
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"]
const CDN_BASE = "https://cdn.jsdelivr.net/gh/netbox-community/devicetype-library@master/elevation-images"

// --- Scan elevation images for a manufacturer ---

async function buildImageIndex(elevationImagesDir: string): Promise<Map<string, Map<string, string>>> {
  // Returns Map<lowercase manufacturer dir, Map<lowercase slug + ".front"/".rear", filename>>
  const index = new Map<string, Map<string, string>>()

  let mfgDirs: string[]
  try {
    mfgDirs = await readdir(elevationImagesDir)
  } catch {
    return index
  }

  for (const mfgDir of mfgDirs) {
    const mfgPath = join(elevationImagesDir, mfgDir)
    try {
      const s = await stat(mfgPath)
      if (!s.isDirectory()) continue
    } catch {
      continue
    }

    const files = await readdir(mfgPath)
    const fileMap = new Map<string, string>()

    for (const file of files) {
      const lower = file.toLowerCase()
      // Match patterns like {slug}.front.png, {slug}.rear.jpg
      for (const ext of IMAGE_EXTENSIONS) {
        if (lower.endsWith(`.front${ext}`)) {
          const slug = lower.slice(0, -(`.front${ext}`.length))
          fileMap.set(`${slug}.front`, file)
        } else if (lower.endsWith(`.rear${ext}`)) {
          const slug = lower.slice(0, -(`.rear${ext}`.length))
          fileMap.set(`${slug}.rear`, file)
        }
      }
    }

    if (fileMap.size > 0) {
      index.set(mfgDir, fileMap)
    }
  }

  return index
}

function findImageUrl(
  imageIndex: Map<string, Map<string, string>>,
  mfgDir: string,
  slug: string,
  face: "front" | "rear",
): string | null {
  const mfgMap = imageIndex.get(mfgDir)
  if (!mfgMap) return null
  const filename = mfgMap.get(`${slug.toLowerCase()}.${face}`)
  if (!filename) return null
  return `${CDN_BASE}/${encodeURIComponent(mfgDir)}/${encodeURIComponent(filename)}`
}

// --- Parse YAML files in a manufacturer subdirectory ---

async function parseYamlDir<T>(dirPath: string): Promise<{ mfgDir: string; data: T }[]> {
  const results: { mfgDir: string; data: T }[] = []

  let entries: string[]
  try {
    entries = await readdir(dirPath)
  } catch {
    return results
  }

  for (const mfgDir of entries) {
    const mfgPath = join(dirPath, mfgDir)
    try {
      const s = await stat(mfgPath)
      if (!s.isDirectory()) continue
    } catch {
      continue
    }

    const files = await readdir(mfgPath)
    for (const file of files) {
      const ext = extname(file)
      if (ext !== ".yaml" && ext !== ".yml") continue

      try {
        const content = await readFile(join(mfgPath, file), "utf-8")
        const data = parse(content)
        if (data) {
          // Inject file-derived slug if missing
          if (!data.slug) data.slug = basename(file, ext)
          results.push({ mfgDir, data })
        }
      } catch {
        // skip unparseable files
      }
    }
  }

  return results
}

// --- Import device types ---

async function importDeviceTypes(
  repoRoot: string,
  imageIndex: Map<string, Map<string, string>>,
): Promise<{ catalog: DeviceCatalogEntry[]; skipped: number }> {
  const deviceTypesDir = join(repoRoot, "device-types")
  const parsed = await parseYamlDir<NetBoxDeviceType>(deviceTypesDir)

  const catalog: DeviceCatalogEntry[] = []
  const slugsSeen = new Set<string>()
  let skipped = 0

  for (const { mfgDir, data } of parsed) {
    if (!data.model) { skipped++; continue }

    const manufacturer = data.manufacturer || mfgDir
    const model = data.model
    const slug = data.slug || mfgDir
    const uHeight = data.u_height ?? 1

    if (uHeight === 0) { skipped++; continue }
    if (slugsSeen.has(slug)) { skipped++; continue }
    slugsSeen.add(slug)

    // Resolve image URLs
    let frontImageUrl: string | null = null
    let rearImageUrl: string | null = null

    if (data.front_image) {
      frontImageUrl = findImageUrl(imageIndex, mfgDir, slug, "front")
    }
    if (data.rear_image) {
      rearImageUrl = findImageUrl(imageIndex, mfgDir, slug, "rear")
    }

    catalog.push({
      manufacturer,
      model,
      slug,
      uHeight,
      isFullDepth: data.is_full_depth !== false,
      weightKg: toKg(data.weight, data.weight_unit),
      maxPowerWatts: extractMaxPower(data["power-ports"]),
      category: inferCategory(slug, model, manufacturer),
      frontImageUrl,
      rearImageUrl,
    })
  }

  catalog.sort((a, b) =>
    a.manufacturer.localeCompare(b.manufacturer) || a.model.localeCompare(b.model)
  )

  return { catalog, skipped }
}

// --- Import rack types ---

async function importRackTypes(repoRoot: string): Promise<{ catalog: RackCatalogEntry[]; skipped: number }> {
  const rackTypesDir = join(repoRoot, "rack-types")
  const parsed = await parseYamlDir<NetBoxRackType>(rackTypesDir)

  const catalog: RackCatalogEntry[] = []
  const slugsSeen = new Set<string>()
  let skipped = 0

  for (const { mfgDir, data } of parsed) {
    if (!data.model) { skipped++; continue }

    const manufacturer = data.manufacturer || mfgDir
    const slug = data.slug || mfgDir

    if (slugsSeen.has(slug)) { skipped++; continue }
    slugsSeen.add(slug)

    catalog.push({
      manufacturer,
      model: data.model,
      slug,
      formFactor: data.form_factor ?? null,
      uHeight: data.u_height ?? 42,
      width: data.width ?? null,
      outerWidth: data.outer_width ?? null,
      outerHeight: data.outer_height ?? null,
      outerDepth: data.outer_depth ?? null,
      outerDimensionUnit: data.outer_unit ?? null,
      weight: data.weight ?? null,
      maxWeight: data.max_weight ?? null,
      weightUnit: data.weight_unit ?? null,
      mountingDepth: data.mounting_depth ?? null,
      startingUnit: data.starting_unit ?? 1,
      description: data.description ?? null,
    })
  }

  catalog.sort((a, b) =>
    a.manufacturer.localeCompare(b.manufacturer) || a.model.localeCompare(b.model)
  )

  return { catalog, skipped }
}

// --- Import module types ---

async function importModuleTypes(repoRoot: string): Promise<{ catalog: ModuleCatalogEntry[]; skipped: number }> {
  const moduleTypesDir = join(repoRoot, "module-types")
  const parsed = await parseYamlDir<NetBoxModuleType>(moduleTypesDir)

  const catalog: ModuleCatalogEntry[] = []
  const slugsSeen = new Set<string>()
  let skipped = 0

  for (const { mfgDir, data } of parsed) {
    if (!data.model) { skipped++; continue }

    const manufacturer = data.manufacturer || mfgDir
    const slug = data.slug || mfgDir

    if (slugsSeen.has(slug)) { skipped++; continue }
    slugsSeen.add(slug)

    catalog.push({
      manufacturer,
      model: data.model,
      slug,
      partNumber: data.part_number ?? null,
      weightKg: toKg(data.weight, data.weight_unit),
      description: data.description ?? null,
      interfaceCount: data.interfaces?.length ?? 0,
      consolePortCount: data["console-ports"]?.length ?? 0,
      powerPortCount: data["power-ports"]?.length ?? 0,
      moduleBayCount: data["module-bays"]?.length ?? 0,
    })
  }

  catalog.sort((a, b) =>
    a.manufacturer.localeCompare(b.manufacturer) || a.model.localeCompare(b.model)
  )

  return { catalog, skipped }
}

// --- Main ---

async function main() {
  const rawArg = process.argv[2]
  if (!rawArg) {
    console.error("Usage: npx tsx scripts/import-netbox-catalog.ts <path-to-repo-root>")
    console.error("  (also accepts legacy <path-to-device-types-dir>)")
    process.exit(1)
  }

  const repoRoot = resolveRepoRoot(rawArg)
  const outDir = join(import.meta.dirname, "..", "src", "lib")

  console.log(`Repository root: ${repoRoot}`)

  // Build elevation image index
  const imageIndex = await buildImageIndex(join(repoRoot, "elevation-images"))

  // Import all three catalogs
  const [devices, racks, modules] = await Promise.all([
    importDeviceTypes(repoRoot, imageIndex),
    importRackTypes(repoRoot),
    importModuleTypes(repoRoot),
  ])

  // Write device catalog
  const deviceOutput = {
    generatedAt: new Date().toISOString(),
    source: "https://github.com/netbox-community/devicetype-library",
    deviceCount: devices.catalog.length,
    devices: devices.catalog,
  }
  await writeFile(join(outDir, "netbox-catalog.json"), JSON.stringify(deviceOutput))

  // Write rack catalog
  const rackOutput = {
    generatedAt: new Date().toISOString(),
    source: "https://github.com/netbox-community/devicetype-library",
    rackTypeCount: racks.catalog.length,
    rackTypes: racks.catalog,
  }
  await writeFile(join(outDir, "netbox-rack-catalog.json"), JSON.stringify(rackOutput))

  // Write module catalog
  const moduleOutput = {
    generatedAt: new Date().toISOString(),
    source: "https://github.com/netbox-community/devicetype-library",
    moduleTypeCount: modules.catalog.length,
    moduleTypes: modules.catalog,
  }
  await writeFile(join(outDir, "netbox-module-catalog.json"), JSON.stringify(moduleOutput))

  // Stats
  const deviceCategories = new Map<string, number>()
  for (const d of devices.catalog) {
    deviceCategories.set(d.category, (deviceCategories.get(d.category) ?? 0) + 1)
  }

  const devicesWithImages = devices.catalog.filter((d) => d.frontImageUrl || d.rearImageUrl).length

  console.log(`\nNetBox Import Complete`)
  console.log(`\n  Device Types: ${devices.catalog.length} (skipped ${devices.skipped})`)
  console.log(`  Manufacturers: ${new Set(devices.catalog.map((d) => d.manufacturer)).size}`)
  console.log(`  With images: ${devicesWithImages}`)
  console.log(`  Categories:`)
  for (const [cat, count] of [...deviceCategories.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`)
  }
  console.log(`\n  Rack Types: ${racks.catalog.length} (skipped ${racks.skipped})`)
  console.log(`  Module Types: ${modules.catalog.length} (skipped ${modules.skipped})`)
  console.log(`\nOutput:`)
  console.log(`  ${join(outDir, "netbox-catalog.json")}`)
  console.log(`  ${join(outDir, "netbox-rack-catalog.json")}`)
  console.log(`  ${join(outDir, "netbox-module-catalog.json")}`)
}

main().catch(console.error)
