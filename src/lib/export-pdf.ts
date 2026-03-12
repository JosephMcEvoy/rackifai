import { jsPDF } from "jspdf"
import "svg2pdf.js"
import { renderSingleFaceSvg, renderRackPairSvg } from "./export-svg"
import type { ExportRackBundle } from "./export-svg"

export interface PdfExportOptions {
  projectName?: string
  pageSize?: "a4" | "letter" | "a3"
  orientation?: "portrait" | "landscape"
  includeHeader?: boolean
}

/**
 * Export racks as a multi-page vector PDF.
 *
 * Portrait: each rack gets two pages (front, rear) — one face per page.
 * Landscape: each rack gets one page with front+rear side by side.
 */
export async function exportPdf(
  racks: ExportRackBundle[],
  options: PdfExportOptions = {}
) {
  const {
    projectName = "Rack Layout",
    pageSize = "letter",
    orientation = "portrait",
    includeHeader = true,
  } = options

  if (racks.length === 0) return

  const pageSizes: Record<string, [number, number]> = {
    a4: [210, 297],
    letter: [215.9, 279.4],
    a3: [297, 420],
  }
  const [pageW, pageH] = orientation === "landscape"
    ? [pageSizes[pageSize][1], pageSizes[pageSize][0]]
    : pageSizes[pageSize]

  const margin = 12
  const headerH = includeHeader ? 18 : 0

  const pdf = new jsPDF({ orientation, unit: "mm", format: pageSize })

  let pageNum = 0
  const totalPages = orientation === "portrait" ? racks.length * 2 : racks.length

  for (let i = 0; i < racks.length; i++) {
    const bundle = racks[i]

    if (orientation === "portrait") {
      // Page 1: Front view
      if (pageNum > 0) pdf.addPage()
      pageNum++
      await renderPdfPage(pdf, bundle, "front", {
        pageW, pageH, margin, headerH, includeHeader, projectName, pageNum, totalPages,
      })

      // Page 2: Rear view
      pdf.addPage()
      pageNum++
      await renderPdfPage(pdf, bundle, "rear", {
        pageW, pageH, margin, headerH, includeHeader, projectName, pageNum, totalPages,
      })
    } else {
      // Landscape: front+rear on one page
      if (pageNum > 0) pdf.addPage()
      pageNum++
      await renderPdfPagePair(pdf, bundle, {
        pageW, pageH, margin, headerH, includeHeader, projectName, pageNum, totalPages,
      })
    }
  }

  pdf.save(`${sanitize(projectName)}-rack-layout.pdf`)
}

// ─── Page renderers ──────────────────────────────────────────────

interface PageCtx {
  pageW: number; pageH: number; margin: number; headerH: number
  includeHeader: boolean; projectName: string; pageNum: number; totalPages: number
}

/** Portrait: single face per page */
async function renderPdfPage(
  pdf: jsPDF,
  bundle: ExportRackBundle,
  face: "front" | "rear",
  ctx: PageCtx
) {
  const { pageW, pageH, margin, headerH, includeHeader, projectName, pageNum, totalPages } = ctx

  // Header
  if (includeHeader) {
    addPageHeader(pdf, margin, pageW, bundle.rack.name, face.toUpperCase(), projectName)
  }

  // Generate SVG for this single face
  const svgStr = renderSingleFaceSvg(bundle, face, {
    rackLabel: bundle.rack.name,
    includeHeader: false,
  })

  // Parse and render
  const svgEl = parseSvg(svgStr)
  const svgW = parseFloat(svgEl.getAttribute("width") || "400")
  const svgH = parseFloat(svgEl.getAttribute("height") || "600")

  const availW = pageW - 2 * margin
  const availH = pageH - 2 * margin - headerH - 8 // 8mm footer
  const scale = Math.min(availW / svgW, availH / svgH, 1)
  const renderW = svgW * scale
  const renderH = svgH * scale

  const offsetX = margin + (availW - renderW) / 2
  const offsetY = margin + headerH + (availH - renderH) / 2

  await pdf.svg(svgEl, { x: offsetX, y: offsetY, width: renderW, height: renderH })

  // Footer
  addPageFooter(pdf, pageW, pageH, pageNum, totalPages)
}

/** Landscape: front+rear side by side */
async function renderPdfPagePair(
  pdf: jsPDF,
  bundle: ExportRackBundle,
  ctx: PageCtx
) {
  const { pageW, pageH, margin, headerH, includeHeader, projectName, pageNum, totalPages } = ctx

  if (includeHeader) {
    addPageHeader(pdf, margin, pageW, bundle.rack.name, "FRONT & REAR", projectName)
  }

  const svgStr = renderRackPairSvg(bundle, { includeHeader: false })

  const svgEl = parseSvg(svgStr)
  const svgW = parseFloat(svgEl.getAttribute("width") || "800")
  const svgH = parseFloat(svgEl.getAttribute("height") || "600")

  const availW = pageW - 2 * margin
  const availH = pageH - 2 * margin - headerH - 8
  const scale = Math.min(availW / svgW, availH / svgH, 1)
  const renderW = svgW * scale
  const renderH = svgH * scale

  const offsetX = margin + (availW - renderW) / 2
  const offsetY = margin + headerH + (availH - renderH) / 2

  await pdf.svg(svgEl, { x: offsetX, y: offsetY, width: renderW, height: renderH })

  addPageFooter(pdf, pageW, pageH, pageNum, totalPages)
}

// ─── PDF helpers ─────────────────────────────────────────────────

function addPageHeader(
  pdf: jsPDF, margin: number, pageW: number,
  rackName: string, faceLabel: string, projectName: string
) {
  const date = new Date().toISOString().split("T")[0]

  pdf.setFontSize(12)
  pdf.setTextColor(50, 50, 70)
  pdf.text(rackName, margin, margin + 5)

  pdf.setFontSize(9)
  pdf.setTextColor(120, 120, 150)
  pdf.text(faceLabel, margin, margin + 12)

  pdf.setFontSize(8)
  pdf.text(`${projectName} — ${date}`, pageW - margin, margin + 5, { align: "right" })

  pdf.setDrawColor(200)
  pdf.line(margin, margin + 16, pageW - margin, margin + 16)
}

function addPageFooter(
  pdf: jsPDF, pageW: number, pageH: number,
  pageNum: number, totalPages: number
) {
  pdf.setFontSize(8)
  pdf.setTextColor(150)
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageW / 2, pageH - 6, { align: "center" })
}

function parseSvg(svgString: string): HTMLElement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, "image/svg+xml")
  return doc.documentElement
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase()
}
