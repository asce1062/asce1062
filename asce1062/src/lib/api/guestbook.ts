/**
 * Guestbook API utilities
 * Handles Netlify Forms API integration
 */

export interface GuestEntry {
  id: string;
  name: string;
  body: string;
  created_at: string;
  human_fields: {
    Name: string;
    Message: string;
    Url?: string;
    Email?: string;
  };
}

/**
 * Fetch guestbook entries from Netlify Forms API
 */
export async function getGuestEntries(): Promise<GuestEntry[]> {
  try {
    const formId = import.meta.env.GUESTBOOK_ID;
    const token = import.meta.env.NETLIFY_ACCESS;

    if (!formId || !token) {
      console.error(
        "Missing GUESTBOOK_ID or NETLIFY_ACCESS environment variables",
      );
      return [];
    }

    const response = await fetch(
      `https://api.netlify.com/api/v1/forms/${formId}/submissions`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch guest entries:", error);
    return [];
  }
}

/**
 * Generate initials from a name (up to 2 characters)
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format date for guestbook entry display
 */
export function formatEntryDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-gb", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
