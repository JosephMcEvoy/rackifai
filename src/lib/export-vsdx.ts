import JSZip from "jszip"
import { DEVICE_COLORS, type DeviceCategory } from "@/canvas/device"
import type { RackData } from "@/canvas/rack"
import type { DeviceFace } from "@/store/rack-store"

export interface VsdxDevice {
  id: string
  catalogId: string
  name: string
  manufacturer: string
  model: string
  uHeight: number
  isFullDepth: boolean
  startU: number
  category: DeviceCategory
  face?: DeviceFace
}

export interface VsdxExportOptions {
  projectName?: string
  includeImages?: boolean
  racks: Array<{
    data: RackData
    devices: VsdxDevice[]
  }>
  /** Resolve a device catalogId+face to an image URL. Called only when includeImages=true. */
  resolveImage?: (catalogId: string, face: "front" | "rear") => string | null
}

// Visio uses inches, origin at bottom-left
const U_HEIGHT = 0.25
const RACK_INNER_W = 2.5
const RAIL_W = 0.3
const RACK_W = RACK_INNER_W + 2 * RAIL_W
const RACK_GAP = 1.5 // gap between front/rear pair
const PAIR_GAP = 2.5 // gap between rack pairs
const PAGE_MARGIN = 1.0

// ─── Per-export mutable state (reset each call) ──────────────────

let _shapeId = 0
function nextId() { return ++_shapeId }

/** Embedded media: file name → { data, mime, rId } */
const _media = new Map<string, { data: Uint8Array; mime: string; rId: string }>()
let _mediaSeq = 0

/** Register a media file and return its relationship ID. */
function addMedia(data: Uint8Array, mime: string): string {
  const ext = mime.includes("png") ? "png" : "jpeg"
  const name = `image${++_mediaSeq}.${ext}`
  const rId = `rId${100 + _mediaSeq}`
  _media.set(name, { data, mime, rId })
  return rId
}

function resetState() {
  _shapeId = 0
  _media.clear()
  _mediaSeq = 0
}

// ─── Main export ─────────────────────────────────────────────────

export async function exportVsdx(options: VsdxExportOptions) {
  const { projectName = "rack-layout", racks, includeImages = false, resolveImage } = options
  resetState()

  // Pre-fetch images if enabled
  const imageCache = new Map<string, { data: Uint8Array; mime: string } | null>()
  if (includeImages && resolveImage) {
    const fetches: Promise<void>[] = []
    for (const rack of racks) {
      for (const dev of rack.devices) {
        for (const face of ["front", "rear"] as const) {
          const key = `${dev.catalogId}:${face}`
          if (imageCache.has(key)) continue
          imageCache.set(key, null)
          const url = resolveImage(dev.catalogId, face)
          if (!url) continue
          fetches.push(
            fetchImageAsBytes(url)
              .then((r) => { if (r) imageCache.set(key, r) })
              .catch(() => {/* skip */})
          )
        }
      }
    }
    await Promise.all(fetches)
  }

  // Layout: each rack gets a front + rear column
  const pairW = RACK_W * 2 + RACK_GAP
  const totalW = racks.length * pairW + (racks.length - 1) * PAIR_GAP + 2 * PAGE_MARGIN
  const maxU = Math.max(...racks.map(r => r.data.uCount), 42)
  const headerH = 0.6
  const totalH = maxU * U_HEIGHT + headerH + 2 * PAGE_MARGIN

  // Build shapes — grouped by rack pair, with devices as sub-groups
  const shapes: string[] = []
  racks.forEach((rack, rackIndex) => {
    const pairX = PAGE_MARGIN + rackIndex * (pairW + PAIR_GAP)
    const rackBodyH = rack.data.uCount * U_HEIGHT
    const rackPairH = rackBodyH + headerH

    // All children use coordinates local to the rack pair group
    const pairChildren: string[] = []

    for (const viewFace of ["front", "rear"] as const) {
      const localColX = viewFace === "front" ? 0 : RACK_W + RACK_GAP

      // Rack frame + U-labels (local coords)
      renderRackFrame(pairChildren, localColX, 0, rackBodyH, rack.data.uCount)

      // Face label
      pairChildren.push(textShape({
        x: localColX, y: rackBodyH + 0.35, w: RACK_W, h: 0.2,
        text: viewFace === "front" ? "FRONT" : "REAR",
        color: "#8888AA", size: 0.09,
      }))

      // Rack name
      pairChildren.push(textShape({
        x: localColX, y: rackBodyH + 0.05, w: RACK_W, h: 0.3,
        text: rack.data.name, color: "#E0E0E8", size: 0.12, bold: true,
      }))

      // Devices for this face — each device is a nested group
      const faceDevices = rack.devices.filter(
        (d) => d.isFullDepth || (d.face ?? "front") === viewFace
      )

      for (const device of faceDevices) {
        const devH = device.uHeight * U_HEIGHT
        const devLocalY = (device.startU - 1) * U_HEIGHT
        const devLocalX = localColX + RAIL_W + 0.02
        const devW = RACK_INNER_W - 0.04
        const catColor = DEVICE_COLORS[device.category]
        const isGhost = device.isFullDepth ? false : (device.face ?? "front") !== viewFace

        pairChildren.push(buildDeviceGroup(
          device, devLocalX, devLocalY, devW, devH,
          catColor, viewFace, isGhost, imageCache, includeImages,
        ))
      }
    }

    // Wrap the entire rack pair in a group
    shapes.push(groupShape(
      `Rack: ${rack.data.name}`, pairX, PAGE_MARGIN, pairW, rackPairH, pairChildren,
    ))
  })

  // Assemble ZIP
  const zip = new JSZip()
  const hasMedia = _media.size > 0

  for (const [name, entry] of _media) {
    zip.file(`visio/media/${name}`, entry.data)
  }

  zip.file("[Content_Types].xml", contentTypesXml(hasMedia))
  zip.file("_rels/.rels", relsXml())
  zip.file("visio/document.xml", documentXml(projectName))
  zip.file("visio/_rels/document.xml.rels", documentRelsXml())
  zip.file("visio/pages/pages.xml", pagesXml())
  zip.file("visio/pages/_rels/pages.xml.rels", pagesRelsXml())
  zip.file("visio/pages/page1.xml", buildPageXml(shapes, totalW, totalH))

  // page1.xml needs its own .rels file when it references media
  if (hasMedia) {
    zip.file("visio/pages/_rels/page1.xml.rels", page1RelsXml())
  }

  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${sanitizeFilename(projectName)}-rack-layout.vsdx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Rack frame rendering ────────────────────────────────────────

function renderRackFrame(out: string[], x: number, y: number, bodyH: number, uCount: number) {
  out.push(rectShape({ x, y, w: RACK_W, h: bodyH, fill: "#2A2A3E", stroke: "#4A4A6A", strokeW: 0.02 }))
  out.push(rectShape({ x, y, w: RAIL_W, h: bodyH, fill: "#1E1E32", stroke: "#4A4A6A", strokeW: 0.01 }))
  out.push(rectShape({ x: x + RACK_W - RAIL_W, y, w: RAIL_W, h: bodyH, fill: "#1E1E32", stroke: "#4A4A6A", strokeW: 0.01 }))
  for (let u = 1; u <= uCount; u++) {
    if (u % 3 !== 1 && u !== uCount) continue
    const ly = y + (u - 1) * U_HEIGHT
    out.push(textShape({ x, y: ly, w: RAIL_W, h: U_HEIGHT, text: String(u), color: "#8888AA", size: 0.07 }))
    out.push(textShape({ x: x + RACK_W - RAIL_W, y: ly, w: RAIL_W, h: U_HEIGHT, text: String(u), color: "#8888AA", size: 0.07 }))
  }
}

// ─── Device group ────────────────────────────────────────────────

function buildDeviceGroup(
  device: VsdxDevice,
  parentX: number, parentY: number, w: number, h: number,
  catColor: string, viewFace: DeviceFace, isGhost: boolean,
  imageCache: Map<string, { data: Uint8Array; mime: string } | null>,
  includeImages: boolean,
): string {
  // Children use device-local coords: (0,0) is bottom-left of device
  const children: string[] = []

  // Device body
  children.push(rectShape({
    x: 0, y: 0, w, h,
    fill: darkenHex(catColor, isGhost ? 0.2 : 0.4),
    stroke: isGhost ? darkenHex(catColor, 0.3) : catColor,
    strokeW: 0.01,
  }))

  // Category accent bar
  children.push(rectShape({
    x: 0, y: 0, w: 0.06, h,
    fill: isGhost ? darkenHex(catColor, 0.3) : catColor,
    stroke: isGhost ? darkenHex(catColor, 0.3) : catColor,
    strokeW: 0.005,
  }))

  // Image overlay
  let hasImage = false
  if (includeImages) {
    const imgKey = `${device.catalogId}:${viewFace}`
    const imgData = imageCache.get(imgKey)
    if (imgData) {
      const rId = addMedia(imgData.data, imgData.mime)
      children.push(imageShape({ x: 0, y: 0, w, h, rId }))
      hasImage = true
    }
  }

  // Device label (skip if image covers it)
  if (!hasImage) {
    const label = device.name + (device.manufacturer ? `\n${device.manufacturer} ${device.model}` : "")
    children.push(textShape({
      x: 0.1, y: 0, w: w - 0.15, h,
      text: label, color: isGhost ? "#666680" : "#E0E0E8", size: 0.08,
      hAlign: "left",
    }))
  }

  return groupShape(device.name, parentX, parentY, w, h, children)
}

// ─── XML templates ───────────────────────────────────────────────

function contentTypesXml(hasMedia: boolean): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>${hasMedia ? `
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>` : ""}
  <Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>
  <Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>
  <Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>
</Types>`
}

function relsXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/>
</Relationships>`
}

function documentXml(projectName: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<VisioDocument xmlns="http://schemas.microsoft.com/office/visio/2012/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <DocumentProperties>
    <Title>${esc(projectName)}</Title>
    <Creator>rackifai.com</Creator>
  </DocumentProperties>
  <FaceNames>
    <FaceName ID="0" Name="Calibri" UnicodeRanges="-1 -1 0 0"/>
  </FaceNames>
  <StyleSheets>
    <StyleSheet ID="0" Name="No Style" NameU="No Style">
      <Cell N="LineWeight" V="0.003472222"/>
      <Cell N="LineColor" V="#000000"/>
      <Cell N="LinePattern" V="1"/>
      <Cell N="FillForegnd" V="#FFFFFF"/>
      <Cell N="FillPattern" V="1"/>
      <Cell N="CharFont" V="0"/>
      <Cell N="TxtHeight" V="0.111111"/>
    </StyleSheet>
  </StyleSheets>
</VisioDocument>`
}

function documentRelsXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>
</Relationships>`
}

function pagesXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Page ID="0" Name="Rack Layout" NameU="Rack Layout">
    <Rel r:id="rId1"/>
  </Page>
</Pages>`
}

function pagesRelsXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>
</Relationships>`
}

/** Relationships for page1.xml → media files */
function page1RelsXml(): string {
  const rels: string[] = []
  for (const [name, entry] of _media) {
    rels.push(`  <Relationship Id="${entry.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${name}"/>`)
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels.join("\n")}
</Relationships>`
}

function buildPageXml(shapes: string[], pageW: number, pageH: number): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <PageSheet>
    <Cell N="PageWidth" V="${pageW}"/>
    <Cell N="PageHeight" V="${pageH}"/>
    <Cell N="PageScale" V="1"/>
    <Cell N="DrawingScale" V="1"/>
  </PageSheet>
  <Shapes>
    ${shapes.join("\n    ")}
  </Shapes>
</PageContents>`
}

// ─── Shape primitives ────────────────────────────────────────────

/** Visio group shape. Children use local coords: (0,0) = bottom-left. */
function groupShape(
  name: string, x: number, y: number, w: number, h: number,
  children: string[],
): string {
  const id = nextId()
  return `<Shape ID="${id}" Type="Group" NameU="${esc(name)}">
      <Cell N="PinX" V="${x}"/>
      <Cell N="PinY" V="${y}"/>
      <Cell N="Width" V="${w}"/>
      <Cell N="Height" V="${h}"/>
      <Cell N="LocPinX" V="0"/>
      <Cell N="LocPinY" V="0"/>
      <Cell N="FillPattern" V="0"/>
      <Cell N="LinePattern" V="0"/>
      <Shapes>
        ${children.join("\n        ")}
      </Shapes>
    </Shape>`
}

interface RectOpts {
  x: number; y: number; w: number; h: number
  fill: string; stroke: string; strokeW?: number
}

function rectShape(o: RectOpts): string {
  const id = nextId()
  const cx = o.x + o.w / 2
  const cy = o.y + o.h / 2
  const sw = o.strokeW ?? 0.01

  return `<Shape ID="${id}" Type="Shape" NameU="Rect.${id}">
      <Cell N="PinX" V="${cx}"/>
      <Cell N="PinY" V="${cy}"/>
      <Cell N="Width" V="${o.w}"/>
      <Cell N="Height" V="${o.h}"/>
      <Cell N="LocPinX" V="${o.w / 2}"/>
      <Cell N="LocPinY" V="${o.h / 2}"/>
      <Cell N="FillForegnd" V="${o.fill}"/>
      <Cell N="FillPattern" V="1"/>
      <Cell N="LineColor" V="${o.stroke}"/>
      <Cell N="LinePattern" V="1"/>
      <Cell N="LineWeight" V="${sw}"/>
      <Section N="Geometry" IX="0">
        <Cell N="NoFill" V="0"/>
        <Cell N="NoLine" V="0"/>
        <Row T="RelMoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo" IX="2"><Cell N="X" V="1"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo" IX="3"><Cell N="X" V="1"/><Cell N="Y" V="1"/></Row>
        <Row T="RelLineTo" IX="4"><Cell N="X" V="0"/><Cell N="Y" V="1"/></Row>
        <Row T="RelLineTo" IX="5"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
      </Section>
    </Shape>`
}

interface TextOpts {
  x: number; y: number; w: number; h: number
  text: string; color: string; size?: number
  bold?: boolean; hAlign?: "left" | "center"
}

function textShape(o: TextOpts): string {
  const id = nextId()
  const cx = o.x + o.w / 2
  const cy = o.y + o.h / 2
  const sz = o.size ?? 0.1
  const bold = o.bold ? "1" : "0"
  const hAlign = o.hAlign === "left" ? "0" : "1"

  return `<Shape ID="${id}" Type="Shape" NameU="Text.${id}">
      <Cell N="PinX" V="${cx}"/>
      <Cell N="PinY" V="${cy}"/>
      <Cell N="Width" V="${o.w}"/>
      <Cell N="Height" V="${o.h}"/>
      <Cell N="LocPinX" V="${o.w / 2}"/>
      <Cell N="LocPinY" V="${o.h / 2}"/>
      <Cell N="FillPattern" V="0"/>
      <Cell N="LinePattern" V="0"/>
      <Cell N="VerticalAlign" V="1"/>
      <Cell N="TxtPinX" V="${o.w / 2}"/>
      <Cell N="TxtPinY" V="${o.h / 2}"/>
      <Cell N="TxtWidth" V="${o.w}"/>
      <Cell N="TxtHeight" V="${o.h}"/>
      <Section N="Character" IX="0">
        <Row IX="0">
          <Cell N="Font" V="0"/>
          <Cell N="Color" V="${o.color}"/>
          <Cell N="Size" V="${sz}"/>
          <Cell N="Style" V="${bold}"/>
        </Row>
      </Section>
      <Section N="Paragraph" IX="0">
        <Row IX="0">
          <Cell N="HorzAlign" V="${hAlign}"/>
        </Row>
      </Section>
      <Section N="Geometry" IX="0">
        <Cell N="NoFill" V="1"/>
        <Cell N="NoLine" V="1"/>
        <Row T="RelMoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo" IX="2"><Cell N="X" V="1"/><Cell N="Y" V="0"/></Row>
        <Row T="RelLineTo" IX="3"><Cell N="X" V="1"/><Cell N="Y" V="1"/></Row>
        <Row T="RelLineTo" IX="4"><Cell N="X" V="0"/><Cell N="Y" V="1"/></Row>
        <Row T="RelLineTo" IX="5"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
      </Section>
      <Text>${esc(o.text)}</Text>
    </Shape>`
}

interface ImageOpts {
  x: number; y: number; w: number; h: number
  /** Relationship ID from addMedia() */
  rId: string
}

function imageShape(o: ImageOpts): string {
  const id = nextId()
  const cx = o.x + o.w / 2
  const cy = o.y + o.h / 2

  return `<Shape ID="${id}" Type="Foreign" NameU="Image.${id}">
      <Cell N="PinX" V="${cx}"/>
      <Cell N="PinY" V="${cy}"/>
      <Cell N="Width" V="${o.w}"/>
      <Cell N="Height" V="${o.h}"/>
      <Cell N="LocPinX" V="${o.w / 2}"/>
      <Cell N="LocPinY" V="${o.h / 2}"/>
      <Cell N="ImgOffsetX" V="0"/>
      <Cell N="ImgOffsetY" V="0"/>
      <Cell N="ImgWidth" V="${o.w}"/>
      <Cell N="ImgHeight" V="${o.h}"/>
      <Cell N="FillPattern" V="0"/>
      <Cell N="LinePattern" V="0"/>
      <ForeignData ForeignType="Bitmap">
        <Rel r:id="${o.rId}"/>
      </ForeignData>
    </Shape>`
}

// ─── Helpers ─────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function darkenHex(hex: string, factor: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase()
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase()
}

const ALLOWED_IMAGE_HOSTS = new Set(["raw.githubusercontent.com"])

async function fetchImageAsBytes(url: string): Promise<{ data: Uint8Array; mime: string } | null> {
  try {
    const parsed = new URL(url)
    if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) return null
    const resp = await fetch(url)
    if (!resp.ok) return null
    const mime = resp.headers.get("content-type") ?? "image/png"
    const buf = await resp.arrayBuffer()
    return { data: new Uint8Array(buf), mime: mime.split(";")[0] }
  } catch {
    return null
  }
}
