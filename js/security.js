/**
 * OntheGO - Production Security & Input Sanitization Engine
 * Provides XSS prevention via robust HTML escaping, URL protocol validation,
 * image upload MIME/size verification, PII redaction, and client-side API rate limiting.
 */

window.OntheGoSecurity = {
  // Rate limiting token bucket configuration
  rateLimits: {
    gemini: { maxTokens: 10, refillRatePerSec: 0.5, currentTokens: 10, lastRefill: Date.now() },
    routing: { maxTokens: 20, refillRatePerSec: 1, currentTokens: 20, lastRefill: Date.now() },
    weather: { maxTokens: 15, refillRatePerSec: 0.5, currentTokens: 15, lastRefill: Date.now() }
  },

  /**
   * Sanitizes text to prevent Cross-Site Scripting (XSS).
   * Encodes HTML special characters into safe entity representations.
   * @param {string|any} str
   * @returns {string}
   */
  escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/`/g, "&#96;");
  },

  /**
   * Strips all HTML tags entirely.
   * @param {string} str
   * @returns {string}
   */
  stripHTML(str) {
    if (!str) return "";
    return String(str).replace(/<[^>]*>/g, "");
  },

  /**
   * Validates URLs to prevent javascript: or data: code execution in href attributes.
   * Only allows http:, https:, tel:, and mailto: protocols.
   * @param {string} url
   * @returns {string|null} Safe URL or null if invalid/dangerous
   */
  sanitizeURL(url) {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    // Check for dangerous URI schemes
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
      console.warn("OntheGoSecurity: Blocked dangerous URL protocol:", trimmed);
      return null;
    }

    // Permit valid web directions, tel links, or relative paths
    if (lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("tel:") || lower.startsWith("mailto:") || lower.startsWith("./") || lower.startsWith("/")) {
      return trimmed;
    }

    return null;
  },

  /**
   * Validates an uploaded file object for size, MIME type, and extension safety.
   * @param {File} file
   * @param {Object} options
   * @returns {Object} { isValid: boolean, error: string|null, sanitizedName: string }
   */
  validateImageFile(file, options = {}) {
    const maxSizeMB = options.maxSizeMB || 5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const allowedMimeTypes = options.allowedTypes || ["image/jpeg", "image/png", "image/webp", "image/avif"];

    if (!file) {
      return { isValid: false, error: "No file selected.", sanitizedName: "" };
    }

    if (file.size > maxSizeBytes) {
      return {
        isValid: false,
        error: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${maxSizeMB} MB.`,
        sanitizedName: ""
      };
    }

    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      return {
        isValid: false,
        error: `Unsupported image format: "${file.type}". Allowed formats: JPEG, PNG, WebP, AVIF.`,
        sanitizedName: ""
      };
    }

    // Sanitize filename to prevent path traversal
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.+/g, ".");

    return { isValid: true, error: null, sanitizedName: safeName };
  },

  /**
   * Masks sensitive PII (Personally Identifiable Information) such as phone numbers,
   * booking reference codes, and credit card / UPI numbers.
   * @param {string} text
   * @param {boolean} fullRedaction
   * @returns {string}
   */
  maskPII(text, fullRedaction = false) {
    if (!text || typeof text !== "string") return text;

    let result = text;

    // Mask phone numbers (e.g. +91 90039 55156 -> +91 90039 •••••)
    result = result.replace(/(\+?91[\s-]?)?([6-9]\d{4})[\s-]?(\d{5})/g, (match, prefix, first5, last5) => {
      if (fullRedaction) return "[CONTACT REDACTED]";
      return `${prefix || ""}${first5} •••••`;
    });

    // Mask booking reference / PNR numbers (alphanumeric 8-10 chars)
    result = result.replace(/\b([A-Z0-9]{4})([A-Z0-9]{4,6})\b/g, (match, start, end) => {
      if (match.length >= 8 && match.length <= 10 && /\d/.test(match) && /[A-Z]/.test(match)) {
        if (fullRedaction) return "[REF REDACTED]";
        return `${start}••••`;
      }
      return match;
    });

    // Mask potential API keys and tokens
    result = result.replace(/(?:key|token|auth|secret|bearer)=([a-zA-Z0-9_\-]{8,})/gi, "$1=[REDACTED]");

    return result;
  },

  /**
   * Token bucket rate limiter to prevent flooding external APIs.
   * @param {string} bucketName 'gemini' | 'routing' | 'weather'
   * @returns {boolean} True if allowed, false if rate limit exceeded
   */
  checkRateLimit(bucketName) {
    const bucket = this.rateLimits[bucketName];
    if (!bucket) return true;

    const now = Date.now();
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    bucket.currentTokens = Math.min(bucket.maxTokens, bucket.currentTokens + elapsedSec * bucket.refillRatePerSec);
    bucket.lastRefill = now;

    if (bucket.currentTokens >= 1) {
      bucket.currentTokens -= 1;
      return true;
    }

    console.warn(`OntheGoSecurity: Rate limit throttled for service: "${bucketName}".`);
    return false;
  },

  /**
   * Validates state data against maximum length and sanity constraints.
   * @param {Object} item
   * @param {string} type 'activity' | 'expense' | 'memory' | 'checklist'
   * @returns {Object} { isValid: boolean, sanitizedItem: Object, errors: Array }
   */
  sanitizeRecord(item, type) {
    const errors = [];
    if (!item || typeof item !== "object") {
      return { isValid: false, sanitizedItem: null, errors: ["Invalid record object"] };
    }

    const clean = { ...item };

    if (type === "activity") {
      clean.title = this.escapeHTML((clean.title || "Untitled Stop").slice(0, 150));
      clean.location = this.escapeHTML((clean.location || "").slice(0, 200));
      clean.notes = this.escapeHTML((clean.notes || "").slice(0, 1000));
      clean.time = this.escapeHTML((clean.time || "Flexible").slice(0, 30));
      clean.mapUrl = this.sanitizeURL(clean.mapUrl) || "";
    } else if (type === "expense") {
      clean.description = this.escapeHTML((clean.description || "Expense").slice(0, 150));
      clean.notes = this.escapeHTML((clean.notes || "").slice(0, 500));
      clean.receiptNote = this.escapeHTML((clean.receiptNote || "").slice(0, 100));
      clean.currency = ["INR", "USD", "EUR", "GBP"].includes(clean.currency) ? clean.currency : "INR";
    } else if (type === "memory") {
      clean.title = this.escapeHTML((clean.title || "Memory").slice(0, 150));
      clean.caption = this.escapeHTML((clean.caption || "").slice(0, 300));
      clean.notes = this.escapeHTML((clean.notes || "").slice(0, 2000));
      clean.privateNotes = clean.privateNotes ? this.escapeHTML(clean.privateNotes.slice(0, 2000)) : "";
      clean.favouriteMoment = this.escapeHTML((clean.favouriteMoment || "").slice(0, 300));
      if (clean.photoUrl) clean.photoUrl = this.sanitizeURL(clean.photoUrl) || "";
    } else if (type === "checklist") {
      clean.title = this.escapeHTML((clean.title || "Task").slice(0, 150));
      clean.category = this.escapeHTML((clean.category || "General").slice(0, 50));
    }

    return { isValid: errors.length === 0, sanitizedItem: clean, errors };
  }
};
