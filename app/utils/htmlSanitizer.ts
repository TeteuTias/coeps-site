"use client"
import DOMPurify from "dompurify";

export default function HtmlSanitizer(dirty: string) {
    return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } })
}