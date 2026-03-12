import { describe, it, expect, vi } from "vitest"
import JSZip from "jszip"
import type { VsdxDevice } from "./export-vsdx"

// Mock document/URL/blob for node environment
vi.stubGlobal("document", {
  createElement: () => ({ click: vi.fn(), href: "", download: "" }),
  body: { appendChild: vi.fn(), removeChild: vi.fn() },
})
vi.stubGlobal("URL", {
  createObjectURL: () => "blob://mock",
  revokeObjectURL: vi.fn(),
})

import { exportVsdx } from "./export-vsdx"

const SAMPLE_DEVICES: VsdxDevice[] = [
  {
    id: "dev-1",
    catalogId: "cat-1",
    name: "Web Server",
    manufacturer: "Dell",
    model: "R640",
    uHeight: 1,
    isFullDepth: true,
    startU: 1,
    category: "server",
  },
  {
    id: "dev-2",
    catalogId: "cat-2",
    name: "Core Switch",
    manufacturer: "Cisco",
    model: "Nexus 9300",
    uHeight: 2,
    isFullDepth: false,
    startU: 10,
    category: "switch",
    face: "front",
  },
  {
    id: "dev-3",
    catalogId: "cat-3",
    name: "Rear PDU",
    manufacturer: "APC",
    model: "AP8841",
    uHeight: 1,
    isFullDepth: false,
    startU: 40,
    category: "pdu",
    face: "rear",
  },
]

const SAMPLE_RACKS = [
  {
    data: {
      id: "rack-1",
      name: "Main Rack",
      uCount: 42,
      rackWidthPx: 300,
      startingUnit: 1,
      descendingUnits: false,
    },
    devices: SAMPLE_DEVICES,
  },
]

function captureBlob() {
  let blob: Blob | undefined
  vi.stubGlobal("URL", {
    createObjectURL: (b: Blob) => { blob = b; return "blob://mock" },
    revokeObjectURL: vi.fn(),
  })
  return () => blob!
}

describe("exportVsdx", () => {
  it("generates a valid ZIP with all required VSDX parts", async () => {
    const getBlob = captureBlob()
    await exportVsdx({ projectName: "Test Project", racks: SAMPLE_RACKS })
    const zip = await JSZip.loadAsync(getBlob())
    const files = Object.keys(zip.files)

    expect(files).toContain("[Content_Types].xml")
    expect(files).toContain("_rels/.rels")
    expect(files).toContain("visio/document.xml")
    expect(files).toContain("visio/_rels/document.xml.rels")
    expect(files).toContain("visio/pages/pages.xml")
    expect(files).toContain("visio/pages/_rels/pages.xml.rels")
    expect(files).toContain("visio/pages/page1.xml")
  })

  it("page1.xml has shapes with Geometry, positioning, and patterns", async () => {
    const getBlob = captureBlob()
    await exportVsdx({ projectName: "Test", racks: SAMPLE_RACKS })
    const zip = await JSZip.loadAsync(getBlob())
    const pageXml = await zip.file("visio/pages/page1.xml")!.async("string")

    expect(pageXml).toContain("<PageSheet>")
    expect(pageXml).toContain('N="PageWidth"')
    expect(pageXml).toContain("<Shape ")
    expect(pageXml).toContain('N="Geometry"')
    expect(pageXml).toContain("RelMoveTo")
    expect(pageXml).toContain('N="LocPinX"')
    expect(pageXml).toContain('N="FillPattern"')
    expect(pageXml).toContain('N="LinePattern"')
    expect(pageXml).not.toMatch(/V="RGB\(/)
  })

  it("renders front and rear face labels", async () => {
    const getBlob = captureBlob()
    await exportVsdx({ projectName: "Test", racks: SAMPLE_RACKS })
    const zip = await JSZip.loadAsync(getBlob())
    const pageXml = await zip.file("visio/pages/page1.xml")!.async("string")

    expect(pageXml).toContain("FRONT")
    expect(pageXml).toContain("REAR")
  })

  it("includes device and rack names", async () => {
    const getBlob = captureBlob()
    await exportVsdx({ projectName: "Test", racks: SAMPLE_RACKS })
    const zip = await JSZip.loadAsync(getBlob())
    const pageXml = await zip.file("visio/pages/page1.xml")!.async("string")

    expect(pageXml).toContain("Main Rack")
    expect(pageXml).toContain("Web Server")
    expect(pageXml).toContain("Core Switch")
    expect(pageXml).toContain("Rear PDU")
  })

  it("full-depth device appears in both front and rear", async () => {
    const getBlob = captureBlob()
    await exportVsdx({
      projectName: "Test",
      racks: [{
        data: { id: "r1", name: "R1", uCount: 10, rackWidthPx: 300, startingUnit: 1, descendingUnits: false },
        devices: [{
          id: "d1", catalogId: "c1", name: "FullDepthBox",
          manufacturer: "X", model: "Y", uHeight: 2,
          isFullDepth: true, startU: 1, category: "server",
        }],
      }],
    })
    const zip = await JSZip.loadAsync(getBlob())
    const pageXml = await zip.file("visio/pages/page1.xml")!.async("string")

    // Should appear on both faces (NameU + text label per face = 4)
    const matches = pageXml.match(/FullDepthBox/g)
    expect(matches).toHaveLength(4)
  })

  it("front-only device only appears on front face", async () => {
    const getBlob = captureBlob()
    await exportVsdx({
      projectName: "Test",
      racks: [{
        data: { id: "r1", name: "R1", uCount: 10, rackWidthPx: 300, startingUnit: 1, descendingUnits: false },
        devices: [{
          id: "d1", catalogId: "c1", name: "FrontOnlyDev",
          manufacturer: "X", model: "Y", uHeight: 1,
          isFullDepth: false, startU: 1, category: "switch", face: "front",
        }],
      }],
    })
    const zip = await JSZip.loadAsync(getBlob())
    const pageXml = await zip.file("visio/pages/page1.xml")!.async("string")

    // NameU + text label on front face only = 2
    const matches = pageXml.match(/FrontOnlyDev/g)
    expect(matches).toHaveLength(2)
  })

  it("document.xml has FaceNames and StyleSheets", async () => {
    const getBlob = captureBlob()
    await exportVsdx({ projectName: "Test", racks: SAMPLE_RACKS })
    const zip = await JSZip.loadAsync(getBlob())
    const docXml = await zip.file("visio/document.xml")!.async("string")

    expect(docXml).toContain("<FaceNames>")
    expect(docXml).toContain("<StyleSheets>")
    expect(docXml).toContain("<Title>Test</Title>")
  })

  it("text shapes have Character and Paragraph sections", async () => {
    const getBlob = captureBlob()
    await exportVsdx({ projectName: "Test", racks: SAMPLE_RACKS })
    const zip = await JSZip.loadAsync(getBlob())
    const pageXml = await zip.file("visio/pages/page1.xml")!.async("string")

    expect(pageXml).toContain('N="Character"')
    expect(pageXml).toContain('N="Paragraph"')
    expect(pageXml).toContain('N="HorzAlign"')
  })
})
