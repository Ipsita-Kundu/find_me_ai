import type {
  BackendAlert,
  BackendFoundReport,
  BackendMissingReport,
  CameraFeed,
  ContactRevealResponse,
  CreateFoundPayload,
  CreateMissingPayload,
  CreateMissingResponse,
  LiveCameraScanResponse,
  LiveCameraMatch,
  MatchDetail,
  SurveillanceAlert,
} from "@/types";
import { alertsMock, foundPersonsMock, missingPersonsMock } from "@/mock-data";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  provider: string;
  role: "user" | "authority";
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

interface BackendError {
  detail?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function inferRoleFromEmail(email: string): "user" | "authority" {
  const normalized = email.toLowerCase();
  if (normalized.includes("admin") || normalized.includes("authority")) {
    return "authority";
  }
  return "user";
}

function createMockAuthUser(input: {
  email: string;
  name?: string;
  role?: "user" | "authority";
  provider: string;
}): AuthUser {
  return {
    id: `mock-${input.email}`,
    name: input.name || input.email.split("@")[0] || "Mock User",
    email: input.email,
    provider: input.provider,
    role: input.role ?? inferRoleFromEmail(input.email),
  };
}

function createMockToken(user: AuthUser): string {
  return `mock-token:${user.role}:${user.email}`;
}

function decodeMockToken(token: string): AuthUser | null {
  const parts = token.split(":");
  if (parts.length !== 3 || parts[0] !== "mock-token") {
    return null;
  }

  const role = parts[1] === "authority" ? "authority" : "user";
  const email = parts[2];

  return createMockAuthUser({
    email,
    role,
    provider: "mock",
  });
}

function toBackendMissingReport(): BackendMissingReport[] {
  return missingPersonsMock.map((item, index) => ({
    _id: item.id,
    name: item.name,
    age: item.age ?? null,
    gender: item.gender ?? null,
    last_seen_location: item.location ?? null,
    additional_info: item.description,
    image_path: item.imageUrl,
    created_at: new Date(Date.now() - index * 60_000).toISOString(),
  }));
}

function toBackendFoundReport(): BackendFoundReport[] {
  return foundPersonsMock.map((item, index) => ({
    _id: item.id,
    found_location: item.location ?? null,
    contact_info: item.contact ?? null,
    additional_info: item.description,
    image_path: item.imageUrl,
    created_at: new Date(Date.now() - index * 60_000).toISOString(),
  }));
}

function toBackendAlerts(): BackendAlert[] {
  return alertsMock.map((item, index) => ({
    _id: item.id,
    missing_id: `missing-${index + 1}`,
    found_id: `found-${index + 1}`,
    similarity: Number((item.confidence / 100).toFixed(4)),
    created_at: new Date(Date.now() - index * 120_000).toISOString(),
  }));
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = "Request failed";
    try {
      const errorBody = (await response.json()) as BackendError;
      detail = errorBody.detail ?? detail;
    } catch {
      // Keep fallback detail message when response body is not JSON.
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export async function signupWithEmail(payload: {
  name: string;
  email: string;
  password: string;
  phone_number: string;
  role: "user" | "authority";
}): Promise<AuthResponse> {
  if (USE_MOCK_API) {
    await sleep(300);
    const user = createMockAuthUser({
      email: payload.email,
      name: payload.name,
      role: payload.role,
      provider: "mock",
    });
    return {
      access_token: createMockToken(user),
      token_type: "bearer",
      user,
    };
  }

  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<AuthResponse>(response);
}

export async function loginWithEmail(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  if (USE_MOCK_API) {
    await sleep(250);
    const user = createMockAuthUser({
      email: payload.email,
      provider: "mock",
    });
    return {
      access_token: createMockToken(user),
      token_type: "bearer",
      user,
    };
  }

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<AuthResponse>(response);
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  if (USE_MOCK_API) {
    await sleep(250);
    const suffix = idToken.slice(0, 6) || "google";
    const user = createMockAuthUser({
      email: `${suffix}@mock-google.local`,
      provider: "google",
    });
    return {
      access_token: createMockToken(user),
      token_type: "bearer",
      user,
    };
  }

  const response = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  return parseResponse<AuthResponse>(response);
}

export async function getMe(token: string): Promise<AuthUser> {
  if (USE_MOCK_API) {
    await sleep(150);
    const user = decodeMockToken(token);
    if (!user) {
      throw new Error("Invalid mock token. Please login again.");
    }
    return user;
  }

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<AuthUser>(response);
}

export async function createMissingReport(
  payload: CreateMissingPayload,
  token: string,
): Promise<CreateMissingResponse> {
  if (USE_MOCK_API) {
    await sleep(350);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    void payload;
    return { report_id: "mock-id", matches: [], match_details: [] };
  }

  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("age", payload.age);
  formData.append("gender", payload.gender);
  if (payload.birthmarks?.trim()) {
    formData.append("birthmarks", payload.birthmarks.trim());
  }
  if (payload.lastSeenLocation.trim()) {
    formData.append("last_seen_location", payload.lastSeenLocation.trim());
  }
  formData.append("additional_info", payload.description);
  formData.append("image", payload.image);

  const response = await fetch(`${API_BASE_URL}/missing/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseResponse<CreateMissingResponse>(response);
}

export async function createFoundReport(
  payload: CreateFoundPayload,
  token: string,
): Promise<void> {
  if (USE_MOCK_API) {
    await sleep(350);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    void payload;
    return;
  }

  const formData = new FormData();
  if (payload.age?.trim()) {
    formData.append("estimated_age", payload.age.trim());
  }
  if (payload.gender?.trim()) {
    formData.append("gender", payload.gender.trim());
  }
  if (payload.birthmarks?.trim()) {
    formData.append("birthmarks", payload.birthmarks.trim());
  }
  formData.append("found_location", payload.location);
  formData.append("contact_info", payload.contact);
  formData.append("additional_info", payload.description);
  formData.append("image", payload.image);

  const response = await fetch(`${API_BASE_URL}/found/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  await parseResponse<Record<string, unknown>>(response);
}

export async function fetchMissingReports(
  token: string,
): Promise<BackendMissingReport[]> {
  if (USE_MOCK_API) {
    await sleep(300);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return toBackendMissingReport();
  }

  const response = await fetch(`${API_BASE_URL}/admin/missing`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await parseResponse<{
    missing_reports: BackendMissingReport[];
  }>(response);
  return payload.missing_reports;
}

export async function fetchMyMissingReports(
  token: string,
): Promise<BackendMissingReport[]> {
  if (USE_MOCK_API) {
    await sleep(220);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return toBackendMissingReport();
  }

  const response = await fetch(`${API_BASE_URL}/missing/mine`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<BackendMissingReport[]>(response);
}

export async function fetchAllMissingReports(
  token: string,
): Promise<BackendMissingReport[]> {
  if (USE_MOCK_API) {
    await sleep(300);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return toBackendMissingReport();
  }

  const response = await fetch(`${API_BASE_URL}/missing/all`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<BackendMissingReport[]>(response);
}

export async function fetchFoundReports(
  token: string,
): Promise<BackendFoundReport[]> {
  if (USE_MOCK_API) {
    await sleep(300);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return toBackendFoundReport();
  }

  const response = await fetch(`${API_BASE_URL}/admin/found`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await parseResponse<{ found_reports: BackendFoundReport[] }>(
    response,
  );
  return payload.found_reports;
}

export async function scanLiveCamera(
  image: Blob,
  token: string,
  cameraName?: string,
): Promise<LiveCameraScanResponse> {
  if (USE_MOCK_API) {
    await sleep(400);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return { matches: [] };
  }

  const formData = new FormData();
  formData.append("image", image);
  if (cameraName) {
    formData.append("camera_name", cameraName);
  }

  const requestOptions: RequestInit = {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  };

  const response = await fetch(`${API_BASE_URL}/admin/webcam-scan`, requestOptions);
  if (response.status === 404) {
    const fallbackResponse = await fetch(`${API_BASE_URL}/webcam-scan`, requestOptions);
    if (fallbackResponse.ok) {
      return parseResponse<LiveCameraScanResponse>(fallbackResponse);
    }
    if (fallbackResponse.status !== 404) {
      return parseResponse<LiveCameraScanResponse>(fallbackResponse);
    }

    const fallbackBody = await fallbackResponse.json().catch(() => null);
    const detail = fallbackBody?.detail ?? "Live scan endpoint not found.";
    throw new Error(detail);
  }

  return parseResponse<LiveCameraScanResponse>(response);
}

export async function listCameras(token: string): Promise<CameraFeed[]> {
  if (USE_MOCK_API) {
    await sleep(200);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return [
      {
        id: "CAM-01",
        name: "Front Entrance",
        location: "Main Gate",
        status: "online",
        stream_url: "/camera/CAM-01/stream",
        last_updated: new Date().toISOString(),
      },
      {
        id: "CAM-02",
        name: "Parking Lot",
        location: "East Wing",
        status: "online",
        stream_url: "/camera/CAM-02/stream",
        last_updated: new Date().toISOString(),
      },
      {
        id: "CAM-03",
        name: "Corridor",
        location: "Building B",
        status: "offline",
        stream_url: undefined,
        last_updated: new Date().toISOString(),
      },
    ];
  }

  const response = await fetch(`${API_BASE_URL}/admin/cameras`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await parseResponse<{ cameras: CameraFeed[] }>(response);
  return payload.cameras;
}

export async function getSurveillanceLiveAlerts(
  token: string,
  cameraId?: string,
  limit: number = 50,
): Promise<SurveillanceAlert[]> {
  if (USE_MOCK_API) {
    await sleep(250);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return [];
  }

  const params = new URLSearchParams();
  if (cameraId) {
    params.append("camera_id", cameraId);
  }
  params.append("limit", String(limit));

  const response = await fetch(
    `${API_BASE_URL}/admin/surveillance-live?${params.toString()}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const payload = await parseResponse<{ alerts: SurveillanceAlert[] }>(response);
  return payload.alerts;
}

export async function fetchMyFoundReports(
  token: string,
): Promise<BackendFoundReport[]> {
  if (USE_MOCK_API) {
    await sleep(220);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return toBackendFoundReport();
  }

  const response = await fetch(`${API_BASE_URL}/found/mine`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<BackendFoundReport[]>(response);
}

export async function fetchAllFoundReports(
  token: string,
): Promise<BackendFoundReport[]> {
  if (USE_MOCK_API) {
    await sleep(300);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return toBackendFoundReport();
  }

  const response = await fetch(`${API_BASE_URL}/found/all`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<BackendFoundReport[]>(response);
}

export async function fetchAlerts(token: string): Promise<BackendAlert[]> {
  if (USE_MOCK_API) {
    await sleep(250);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return toBackendAlerts();
  }

  const response = await fetch(`${API_BASE_URL}/admin/alerts`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await parseResponse<{ alerts: BackendAlert[] }>(response);
  return payload.alerts;
}

export async function fetchMyAlerts(token: string): Promise<BackendAlert[]> {
  if (USE_MOCK_API) {
    await sleep(250);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return toBackendAlerts();
  }

  const response = await fetch(`${API_BASE_URL}/auth/my-alerts`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await parseResponse<{ alerts: BackendAlert[] }>(response);
  return payload.alerts;
}

export async function markAlertRead(
  alertId: string,
  token: string,
): Promise<void> {
  if (USE_MOCK_API) return;
  await fetch(`${API_BASE_URL}/auth/alerts/${alertId}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markAllAlertsRead(token: string): Promise<void> {
  if (USE_MOCK_API) return;
  await fetch(`${API_BASE_URL}/auth/alerts/read-all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function clearAllAlerts(token: string): Promise<void> {
  if (USE_MOCK_API) return;
  await fetch(`${API_BASE_URL}/auth/alerts/clear`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function resetDatabase(token: string): Promise<{
  deleted: { missing_reports: number; found_reports: number; alerts: number };
}> {
  const response = await fetch(`${API_BASE_URL}/admin/reset-database`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(response);
}

export async function fetchMatchesForReport(
  reportId: string,
  token: string,
): Promise<{ matches: MatchDetail[]; missingName: string; missingImagePath: string | null }> {
  if (USE_MOCK_API) {
    await sleep(250);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return { matches: [], missingName: "Unknown", missingImagePath: null };
  }

  const response = await fetch(`${API_BASE_URL}/missing/${reportId}/matches`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<{
    report_id: string;
    missing_name: string;
    missing_image_path: string | null;
    matches: MatchDetail[];
  }>(response);
  return {
    matches: data.matches,
    missingName: data.missing_name ?? "Unknown",
    missingImagePath: data.missing_image_path ?? null,
  };
}

export async function deleteMissingReport(
  reportId: string,
  token: string,
): Promise<void> {
  if (USE_MOCK_API) {
    await sleep(200);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return;
  }

  const response = await fetch(`${API_BASE_URL}/missing/${reportId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await parseResponse<{ message: string }>(response);
}

export async function deleteFoundReport(
  reportId: string,
  token: string,
): Promise<void> {
  if (USE_MOCK_API) {
    await sleep(200);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return;
  }

  const response = await fetch(`${API_BASE_URL}/found/${reportId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await parseResponse<{ message: string }>(response);
}

export async function revealContact(
  alertId: string,
  token: string,
): Promise<ContactRevealResponse> {
  if (USE_MOCK_API) {
    await sleep(200);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return {
      finder_name: "Mock User",
      finder_phone: "+1234567890",
      similarity: 0.85,
    };
  }

  const response = await fetch(
    `${API_BASE_URL}/auth/alerts/${alertId}/contact`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return parseResponse<ContactRevealResponse>(response);
}


// Add this new function to your existing api.ts file
// Place it right after fetchMyFoundReports()

/**
 * NEW — fixes cross-account match visibility.
 *
 * If the logged-in user uploaded a FOUND report and it matched someone else's
 * MISSING report, this returns those missing reports (from any account) along
 * with the best similarity score so they appear on the dashboard.
 */
export async function fetchMissingReportsMatchedToMyFound(
  token: string,
): Promise<(BackendMissingReport & { best_similarity: number })[]> {
  if (USE_MOCK_API) {
    await sleep(220);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return [];
  }

  const response = await fetch(
    `${API_BASE_URL}/found/matched-missing-reports`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return parseResponse<(BackendMissingReport & { best_similarity: number })[]>(
    response,
  );
}

export async function fetchAllAlerts(token: string): Promise<BackendAlert[]> {
  if (USE_MOCK_API) {
    await sleep(250);
    if (!decodeMockToken(token)) {
      throw new Error("You are not authenticated. Please login again.");
    }
    return toBackendAlerts();
  }

  const response = await fetch(`${API_BASE_URL}/auth/alerts/all`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await parseResponse<BackendAlert[] | { alerts: BackendAlert[] }>(response);
  return Array.isArray(payload) ? payload : (payload.alerts ?? []);
}