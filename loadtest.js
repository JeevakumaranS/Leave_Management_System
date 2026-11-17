import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BASE_URL || "http://localhost:4000/api";

export const options = {
  stages: [
    { duration: "30s", target: 3 },
    { duration: "1m", target: 5 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export function setup() {
  const response = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({
      identifier: __ENV.TEST_USER,
      password: __ENV.TEST_PASSWORD,
    }),
    { headers: { "Content-Type": "application/json" } },
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Login failed: HTTP ${response.status}`);
  }

  const token = response.json("accessToken");
  if (!token) throw new Error("Login response did not contain an access token");
  return { token };
}

export default function (data) {
  const response = http.get(`${baseUrl}/leaves/my`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  check(response, { "my leaves returns 200": (r) => r.status === 200 });
  sleep(1);
}
