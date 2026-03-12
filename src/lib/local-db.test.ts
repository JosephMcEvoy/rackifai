import { describe, it, expect, beforeEach } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import {
  saveLocalProject,
  loadLocalProject,
  listLocalProjects,
  deleteLocalProject,
  isIndexedDBAvailable,
  __resetDB,
} from "./local-db"
import type { LocalProject } from "@/types/project"

function makeProject(overrides: Partial<LocalProject> = {}): LocalProject {
  return {
    id: crypto.randomUUID(),
    name: "Test Project",
    storageMode: "local",
    configJson: { racks: {}, devices: {} },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// Reset IndexedDB between tests — fresh factory + clear singleton
beforeEach(() => {
  __resetDB()
  globalThis.indexedDB = new IDBFactory()
})

describe("local-db CRUD", () => {
  it("saves and loads a project", async () => {
    const project = makeProject({ name: "My Rack" })
    await saveLocalProject(project)

    const loaded = await loadLocalProject(project.id)
    expect(loaded).toBeDefined()
    expect(loaded!.name).toBe("My Rack")
    expect(loaded!.configJson).toEqual({ racks: {}, devices: {} })
  })

  it("returns undefined for missing project", async () => {
    const loaded = await loadLocalProject("nonexistent-id")
    expect(loaded).toBeUndefined()
  })

  it("lists projects sorted by updatedAt descending", async () => {
    const older = makeProject({
      name: "Old",
      updatedAt: "2025-01-01T00:00:00.000Z",
    })
    const newer = makeProject({
      name: "New",
      updatedAt: "2026-03-11T00:00:00.000Z",
    })

    await saveLocalProject(older)
    await saveLocalProject(newer)

    const list = await listLocalProjects()
    expect(list.length).toBe(2)
    expect(list[0].name).toBe("New")
    expect(list[1].name).toBe("Old")
    // configJson should be stripped from list results
    expect((list[0] as Record<string, unknown>).configJson).toBeUndefined()
  })

  it("deletes a project", async () => {
    const project = makeProject()
    await saveLocalProject(project)

    await deleteLocalProject(project.id)

    const loaded = await loadLocalProject(project.id)
    expect(loaded).toBeUndefined()

    const list = await listLocalProjects()
    expect(list.length).toBe(0)
  })

  it("overwrites an existing project on save", async () => {
    const project = makeProject({ name: "V1" })
    await saveLocalProject(project)

    await saveLocalProject({ ...project, name: "V2" })

    const loaded = await loadLocalProject(project.id)
    expect(loaded!.name).toBe("V2")
  })

  it("rejects project with invalid configJson", async () => {
    const project = makeProject()
    // Corrupt the configJson
    ;(project as unknown as Record<string, unknown>).configJson = "not an object"
    await saveLocalProject(project as LocalProject)

    const loaded = await loadLocalProject(project.id)
    expect(loaded).toBeUndefined()
  })
})

describe("isIndexedDBAvailable", () => {
  it("returns true when fake-indexeddb is available", async () => {
    const available = await isIndexedDBAvailable()
    expect(available).toBe(true)
  })
})
