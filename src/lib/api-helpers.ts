/** Build Authorization header from a pre-fetched token. */
export function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface ProjectSummary {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectDetail extends ProjectSummary {
  rackConfigurations: {
    id: string
    projectId: string
    name: string
    configJson: { racks: Record<string, unknown>; devices: Record<string, unknown>; archivedItems?: unknown[] } | null
  }[]
}

export async function listProjects(token?: string | null): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects", {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(`Failed to list projects: ${res.status}`)
  return res.json() as Promise<ProjectSummary[]>
}

export async function loadProject(id: string, token?: string | null): Promise<ProjectDetail> {
  const res = await fetch(`/api/projects/${id}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(`Failed to load project: ${res.status}`)
  return res.json() as Promise<ProjectDetail>
}

export async function createProject(
  name: string,
  configJson?: unknown,
  token?: string | null,
): Promise<{ id: string; name: string }> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ name, configJson }),
  })
  if (!res.ok) throw new Error(`Failed to create project: ${res.status}`)
  return res.json() as Promise<{ id: string; name: string }>
}

export async function deleteProject(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(`Failed to delete project: ${res.status}`)
}

export async function shareProject(id: string, token?: string | null): Promise<{ token: string }> {
  const res = await fetch(`/api/projects/${id}/share`, {
    method: "POST",
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(`Failed to share project: ${res.status}`)
  return res.json() as Promise<{ token: string }>
}

export async function revokeShare(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`/api/projects/${id}/share`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(`Failed to revoke share: ${res.status}`)
}

export interface SharedProjectDetail {
  id: string
  name: string
  description: string | null
  readOnly: true
  rackConfigurations: {
    id: string
    projectId: string
    name: string
    configJson: { racks: Record<string, unknown>; devices: Record<string, unknown>; archivedItems?: unknown[] } | null
  }[]
}

export async function loadSharedProject(token: string): Promise<SharedProjectDetail> {
  const res = await fetch(`/api/share/${token}`)
  if (!res.ok) throw new Error(`Shared project not found: ${res.status}`)
  return res.json() as Promise<SharedProjectDetail>
}

export async function claimProject(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`/api/projects/${id}/claim`, {
    method: "POST",
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(`Failed to claim project: ${res.status}`)
}

// --- Trash ---

export async function listTrashedProjects(token?: string | null): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects/trash", {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(`Failed to list trashed projects: ${res.status}`)
  return res.json() as Promise<ProjectSummary[]>
}

export async function restoreProject(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`/api/projects/${id}/restore`, {
    method: "POST",
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(`Failed to restore project: ${res.status}`)
}

export async function permanentDeleteProject(id: string, token?: string | null): Promise<void> {
  const res = await fetch(`/api/projects/${id}/permanent`, {
    method: "DELETE",
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(`Failed to permanently delete project: ${res.status}`)
}
