export type Gender = "Male" | "Female" | "Other";

export type CaseStatus = "Pending" | "Matched" | "Closed";

export interface PersonRecord {
  id: string;
  name: string;
  age?: number;
  gender?: Gender;
  location?: string;
  description: string;
  imageUrl: string;
  contact?: string;
}

export interface AlertRecord {
  id: string;
  personImage: string;
  confidence: number;
  location: string;
  contactInfo: string;
}

export interface AdminCaseRecord {
  id: string;
  title: string;
  status: CaseStatus;
  mediaType: "image" | "video";
}

export interface BackendMissingReport {
  _id: string;
  name?: string | null;
  age?: number | null;
  gender?: string | null;
  birthmarks?: string | null;
  last_seen_location?: string | null;
  additional_info?: string | null;
  image_path: string;
  status?: string | null;
  created_at: string;
}

export interface BackendFoundReport {
  _id: string;
  estimated_age?: number | null;
  gender?: string | null;
  birthmarks?: string | null;
  found_location?: string | null;
  contact_info?: string | null;
  additional_info?: string | null;
  image_path: string;
  status?: string | null;
  created_at: string;
}

export interface BackendAlert {
  _id: string;
  missing_id?: string;
  found_id?: string;
  authority_record_id?: string;
  similarity?: number;
  scoring?: {
    face_score?: number;
    metadata_score?: number;
    metadata_components?: Record<string, number>;
    weights?: {
      face_weight?: number;
      metadata_weight?: number;
    };
  };
  missing_contact_phone?: string;
  found_contact_phone?: string;
  authority_phone?: string;
  type?: string;
  screenshot_url?: string;
  camera_name?: string;
  authority_name?: string;
  found_location?: string | null;
  found_image_path?: string | null;
  created_at: string;
  read_at?: string | null;
  missing_report?: {
    name?: string;
    image_path?: string;
    last_seen_location?: string;
    age?: number;
    gender?: string;
  };
  found_report?: {
    image_path?: string;
    found_location?: string;
  };
}

export interface LiveCameraMatch {
  missing_id: string;
  missing_name?: string | null;
  missing_age?: number | null;
  missing_gender?: string | null;
  missing_location?: string | null;
  missing_image_path?: string;
  authority_name?: string | null;
  authority_phone?: string | null;
  found_location?: string | null;
  found_image_path?: string | null;
  similarity: number;
  scoring?: {
    face_score?: number;
    metadata_score?: number;
    metadata_components?: Record<string, number>;
    weights?: {
      face_weight?: number;
      metadata_weight?: number;
    };
  };
}

export interface LiveCameraScanResponse {
  matches: LiveCameraMatch[];
  screenshot_url?: string;
}

export interface CameraFeed {
  id: string;
  name: string;
  location: string;
  status: "online" | "offline";
  stream_url?: string;
  last_frame?: string;
  last_updated?: string;
}

export interface SurveillanceAlert {
  id: string;
  timestamp: string;
  camera_id: string;
  camera_name?: string;
  missing_id: string;
  missing_name?: string;
  similarity: number;
  screenshot_url?: string;
}

export interface CreateMissingPayload {
  name: string;
  age: string;
  gender: string;
  birthmarks?: string;
  description: string;
  lastSeenLocation: string;
  image: File;
}

export interface CreateFoundPayload {
  age?: string;
  gender?: string;
  birthmarks?: string;
  location: string;
  description: string;
  contact: string;
  image: File;
}

export interface CreateMissingResponse {
  report_id: string;
  matches: Array<{ missing_id: string; found_id: string; similarity: number }>;
  match_details: Array<{
    missing_id: string;
    found_id: string;
    similarity: number;
    scoring?: Record<string, unknown>;
  }>;
}

export interface MatchDetail {
  _id: string;
  missing_id: string;
  found_id: string;
  similarity: number;
  finder_name: string;
  finder_phone?: string | null;
  found_location?: string | null;
  found_image_path?: string | null;
  scoring?: Record<string, unknown>;
  created_at: string;
}

export interface ContactRevealResponse {
  finder_name: string;
  finder_phone: string | null;
  similarity: number;
}
