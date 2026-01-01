import { ObjectId, type Document, type Filter } from "mongodb"

export type IdVariant = ObjectId | string | number

function uniqueVariants(values: IdVariant[]) {
  const seen = new Set<string>()
  const result: IdVariant[] = []
  for (const value of values) {
    const key =
      value instanceof ObjectId
        ? `objectid:${value.toHexString()}`
        : `${typeof value}:${String(value)}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

export function buildIdVariants(id: string) {
  const variants: IdVariant[] = []
  try {
    variants.push(new ObjectId(id))
  } catch {
    // non-ObjectId ids are allowed
  }
  variants.push(id)
  if (/^\d+$/.test(id)) {
    const numeric = Number(id)
    if (Number.isSafeInteger(numeric)) variants.push(numeric)
  }
  return uniqueVariants(variants)
}

export function buildIdFilter(id: string): Filter<Document> {
  const variants = buildIdVariants(id)
  if (variants.length === 1) return { _id: variants[0] } as Filter<Document>
  return { $or: variants.map((value) => ({ _id: value })) } as Filter<Document>
}

export function buildIdFilterList(ids: string[]): Filter<Document> | null {
  const variants = uniqueVariants(ids.flatMap((id) => buildIdVariants(id)))
  if (!variants.length) return null
  if (variants.length === 1) return { _id: variants[0] } as Filter<Document>
  return { $or: variants.map((value) => ({ _id: value })) } as Filter<Document>
}
