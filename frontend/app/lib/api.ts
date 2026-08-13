/**
 * Bursarly API client — connects to the FastAPI backend.
 * All endpoints are typed against the backend Pydantic schemas.
 *
 * Protected endpoints automatically attach the Supabase Bearer token
 * by calling supabase.auth.getSession() before each request.
 */

import { supabase } from "@/app/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Type Definitions ──

export interface ScholarshipListItem {
  id: string;
  name: string;
  country: string;
  degree_level: string;
  funding_type: string;
  official_url: string | null;
  last_verified_at: string;
  nearest_deadline: string | null;
}

export interface ScholarshipDeadline {
  id: string;
  deadline_date: string;
  cycle_year: number;
  deadline_type: string;
}

export interface ScholarshipDocument {
  id: string;
  document_name: string;
  is_required: boolean;
}

export interface ScholarshipEligibility {
  id: string;
  criteria_text: string;
}

export interface Resource {
  id: string;
  help_category: "essay_help" | "recommendation_letter" | "application_process" | "interview_prep";
  resource_type: "youtube_video" | "professional_service" | "institute" | "article";
  title: string;
  url: string;
  is_free: boolean;
}

export interface ScholarshipDetail {
  id: string;
  name: string;
  country: string;
  degree_level: string;
  funding_type: string;
  official_url: string | null;
  last_verified_at: string;
  status: string;
  source_type: string;
  deadlines: ScholarshipDeadline[];
  documents: ScholarshipDocument[];
  eligibility: ScholarshipEligibility[];
  resources: Resource[];
}

export interface UserScholarship {
  id: string;
  user_id: string;
  scholarship_id: string;
  status: "interested" | "tracking" | "applied";
  added_at: string;
  scholarship: ScholarshipListItem;
}

export interface UserProfile {
  user_id: string;
  degree_level: string | null;
  countries_of_interest: string[];
  field_of_study: string | null;
  needs_full_funding: boolean;
}

export interface UserProfileUpdate {
  degree_level?: string | null;
  countries_of_interest?: string[];
  field_of_study?: string | null;
  needs_full_funding?: boolean;
}

// ── API Error ──

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// ── Fetch helpers ──

/** Public fetch — no auth token attached */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: "Network error" } }));
    throw new ApiError(body?.error?.message || `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

/** Protected fetch — automatically attaches Supabase Bearer token */
export async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: "Network error" } }));
    throw new ApiError(body?.error?.message || `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

// ── Public Scholarship Endpoints ──

export async function getScholarships(filters?: {
  country?: string;
  degree_level?: string;
  funding_type?: string;
}): Promise<ScholarshipListItem[]> {
  const params = new URLSearchParams();
  if (filters?.country) params.set("country", filters.country);
  if (filters?.degree_level) params.set("degree_level", filters.degree_level);
  if (filters?.funding_type) params.set("funding_type", filters.funding_type);
  const qs = params.toString();
  return apiFetch(`/scholarships${qs ? `?${qs}` : ""}`);
}

export async function searchScholarships(query: string): Promise<ScholarshipListItem[]> {
  return apiFetch(`/scholarships/search?q=${encodeURIComponent(query)}`);
}

export async function getScholarshipById(id: string): Promise<ScholarshipDetail> {
  return apiFetch(`/scholarships/${id}`);
}

export async function getScholarshipResources(id: string, category?: string): Promise<Resource[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch(`/scholarships/${id}/resources${qs}`);
}

// ── Protected: Tracker Endpoints ──

export async function addToTracker(
  scholarshipId: string,
  status: "interested" | "tracking" | "applied" = "interested"
): Promise<UserScholarship> {
  return authFetch("/user-scholarships", {
    method: "POST",
    body: JSON.stringify({ scholarship_id: scholarshipId, status }),
  });
}

export async function getMyTrackedScholarships(): Promise<UserScholarship[]> {
  return authFetch("/user-scholarships/me");
}

export async function updateTrackerStatus(
  trackerId: string,
  status: "interested" | "tracking" | "applied"
): Promise<UserScholarship> {
  return authFetch(`/user-scholarships/${trackerId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function removeFromTracker(trackerId: string): Promise<void> {
  return authFetch(`/user-scholarships/${trackerId}`, { method: "DELETE" });
}

// ── Protected: Profile Endpoints ──

export async function getMyProfile(): Promise<UserProfile> {
  return authFetch("/user-profile/me");
}

export async function updateMyProfile(data: UserProfileUpdate): Promise<UserProfile> {
  return authFetch("/user-profile/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ── Protected: Admin Endpoints ──

export async function getPendingScholarships(): Promise<ScholarshipDetail[]> {
  return authFetch("/admin/scholarships");
}

export async function updateScholarshipAdmin(
  id: string,
  data: Partial<ScholarshipDetail>
): Promise<ScholarshipDetail> {
  return authFetch(`/admin/scholarships/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
