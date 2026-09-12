/** Shared upload filename blacklist (static disk + OSS object keys). */
export const DANGEROUS_FILENAME_RE =
  /\.(php|phtml|asp|aspx|exe|sh|bat|cmd|js|mjs|cjs|html|htm|shtml)(\.|$)/i;
