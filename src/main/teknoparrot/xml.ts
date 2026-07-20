import { readFileSync, writeFileSync } from "node:fs"
import { DOMParser, XMLSerializer, type Document, type Element } from "@xmldom/xmldom"

export type { Document, Element } from "@xmldom/xmldom"

const UTF8_BOM = "\uFEFF"

/** Parses an XML file into a DOM document, tolerating a UTF-8 BOM. */
export function parseXmlFile(path: string): Document {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "")
  return new DOMParser().parseFromString(raw, "text/xml")
}

/**
 * Serializes a DOM document back to disk. TeknoParrot's files are written by
 * C#'s XmlSerializer with a UTF-8 BOM, so we preserve that to minimise diffs.
 */
export function writeXmlFile(path: string, doc: Document): void {
  const xml = new XMLSerializer().serializeToString(doc)
  writeFileSync(path, UTF8_BOM + xml, "utf8")
}

/** Returns the first direct child element with the given tag name. */
export function child(parent: Element | Document, tag: string): Element | undefined {
  const node = parent.getElementsByTagName(tag)[0]
  return node ?? undefined
}

/** Returns the trimmed text content of a named child element, or ''. */
export function childText(parent: Element | Document, tag: string): string {
  return child(parent, tag)?.textContent?.trim() ?? ""
}

/** Parses a named child element's text as a boolean ("true"/"false"). */
export function childBool(parent: Element | Document, tag: string): boolean {
  return childText(parent, tag).toLowerCase() === "true"
}

/** Parses a named child element's text as a number, falling back to `fallback`. */
export function childNumber(parent: Element | Document, tag: string, fallback = 0): number {
  const n = Number(childText(parent, tag))
  return Number.isFinite(n) ? n : fallback
}

/**
 * Sets the text content of a named child element if it exists. Returns true if
 * the element was found and updated. Does not create missing elements — this
 * keeps writes limited to fields TeknoParrot already knows about.
 */
export function setChildText(parent: Element | Document, tag: string, value: string): boolean {
  const el = child(parent, tag)
  if (!el) return false
  el.textContent = value
  return true
}

/** Convenience: returns the direct child elements matching a tag name. */
export function childrenByTag(parent: Element, tag: string): Element[] {
  const out: Element[] = []
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i]
    if (node.nodeType === 1 && (node as Element).tagName === tag) {
      out.push(node as Element)
    }
  }
  return out
}

const TEXT_NODE = 3

/** The leading-whitespace indentation of the text node immediately before `node`. */
export function elementIndent(node: Element): string {
  const prev = node.previousSibling
  if (prev && prev.nodeType === TEXT_NODE) {
    const value = prev.nodeValue ?? ""
    const nl = value.lastIndexOf("\n")
    return nl === -1 ? value : value.slice(nl + 1)
  }
  return ""
}

/** Removes `node` along with its immediately-preceding whitespace-only text node. */
function removeWithIndent(parent: Element, node: Element): void {
  const prev = node.previousSibling
  parent.removeChild(node)
  if (prev && prev.nodeType === TEXT_NODE && /^\s*$/.test(prev.nodeValue ?? "")) {
    parent.removeChild(prev)
  }
}

/**
 * Removes every direct child of `parent` named `tag` (with its indentation).
 * Returns true if anything was removed.
 */
export function removeChildElement(parent: Element, tag: string): boolean {
  const existing = childrenByTag(parent, tag)
  for (const el of existing) removeWithIndent(parent, el)
  return existing.length > 0
}

/**
 * Upserts `el` as a direct child of `parent`. When a child named `el.tagName`
 * already exists it is replaced in place (preserving its surrounding
 * whitespace); otherwise `el` is inserted immediately before the first existing
 * child whose tag is in `beforeTags` (in order), falling back to append, with
 * the reference sibling's indentation mirrored so the file stays tidy.
 *
 * Element order matters: C#'s XmlSerializer silently drops elements that appear
 * out of their declared sequence, so callers pass every tag that must follow
 * `el`, earliest first.
 */
export function upsertChildElement(
  parent: Element,
  el: Element,
  beforeTags: string | readonly string[],
): void {
  const existing = childrenByTag(parent, el.tagName)
  if (existing.length > 0) {
    // Replace in place to keep the element's existing position + indentation.
    parent.replaceChild(el, existing[0])
    for (let i = 1; i < existing.length; i++) removeWithIndent(parent, existing[i])
    return
  }

  const tags = typeof beforeTags === "string" ? [beforeTags] : beforeTags
  let ref: Element | undefined
  for (const tag of tags) {
    ref = childrenByTag(parent, tag)[0]
    if (ref) break
  }
  if (!ref) {
    parent.appendChild(el)
    return
  }
  const doc = parent.ownerDocument
  const indent = elementIndent(ref)
  parent.insertBefore(el, ref)
  // Re-establish the newline + indentation in front of the reference sibling,
  // which `el` now sits on.
  if (doc && indent) parent.insertBefore(doc.createTextNode("\n" + indent), ref)
}

/**
 * Builds a nested element (e.g. `<DirectInputButton>`) from `fields`
 * (childTag -> text), pretty-printed one child per line at `childIndent`.
 */
export function buildElement(
  doc: Document,
  tag: string,
  fields: ReadonlyArray<readonly [string, string]>,
  childIndent: string,
): Element {
  const el = doc.createElement(tag)
  const closeIndent = childIndent.slice(2)
  for (const [name, value] of fields) {
    el.appendChild(doc.createTextNode("\n" + childIndent))
    const leaf = doc.createElement(name)
    leaf.textContent = value
    el.appendChild(leaf)
  }
  el.appendChild(doc.createTextNode("\n" + closeIndent))
  return el
}

/**
 * Upserts a leaf element (`<BindNameDi>value</BindNameDi>`) before `beforeTag`,
 * matching sibling indentation. Unlike `setChildText`, this creates the element
 * when it is missing.
 */
export function upsertChildText(
  parent: Element,
  tag: string,
  value: string,
  beforeTags: string | readonly string[],
): void {
  const doc = parent.ownerDocument
  if (!doc) return
  const el = doc.createElement(tag)
  el.textContent = value
  upsertChildElement(parent, el, beforeTags)
}
