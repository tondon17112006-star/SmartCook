import { listAdmin } from '../../services/adminService.js'

// The API caps each page at 100. Fetch every page so larger catalogs remain
// selectable, including ingredients already used by an existing recipe.
export async function loadAllAdminOptions(resource, signal) {
  const records = []
  let page = 1
  do {
    const response = await listAdmin(resource, { page, limit: 100 }, { signal })
    records.push(...response.data)
    if (page >= response.pagination.totalPages) return records
    page += 1
  } while (!signal.aborted)
  return records
}
