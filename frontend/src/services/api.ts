import type {
  BackendAlert,
  BackendFoundReport,
  BackendMissingReport,
  CreateFoundPayload,
  CreateMissingPayload,
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
  formData.append("name", payload.name);
  formData.append("age", payload.age);
  formData.append("gender", payload.gender);
  formData.append("last_seen_location", payload.lastSeenLocation);
  formData.append("additional_info", payload.description);
  formData.append("image", payload.image);

  const response = await fetch(`${API_BASE_URL}/missing/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  await parseResponse<Record<string, unknown>>(response);
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
