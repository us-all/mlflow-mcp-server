import { config } from "./config.js";

export class MlflowError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "MlflowError";
    this.status = status;
    this.body = body;
  }
}

class MlflowClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${config.trackingUri}/api/2.0/mlflow`;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | string[] | undefined>): string {
    const root = path.startsWith("/api/") ? config.trackingUri : this.baseUrl;
    const url = new URL(`${root}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) url.searchParams.append(key, String(v));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private buildAuthHeader(): string | undefined {
    if (config.token) {
      return `Bearer ${config.token}`;
    }
    if (config.username && config.password) {
      const encoded = Buffer.from(`${config.username}:${config.password}`).toString("base64");
      return `Basic ${encoded}`;
    }
    return undefined;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, string | number | boolean | string[] | undefined>;
      body?: unknown;
    },
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    const auth = this.buildAuthHeader();
    if (auth) {
      headers.Authorization = auth;
    }

    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => "");
      }
      throw new MlflowError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        body,
      );
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return {} as T;
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  async get<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("GET", path, { params });
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body: body ?? {} });
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { body: body ?? {} });
  }

  async delete<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("DELETE", path, { body: body ?? {} });
  }
}

export const mlflowClient = new MlflowClient();
