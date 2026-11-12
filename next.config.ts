import type { NextConfig } from "next";

// 보안 헤더: 다른 사이트에 끼워 넣기(클릭재킹)·형식 추측·외부로 새는 참조 주소를 막는다.
// CSP는 개발 서버(핫 리로드가 eval을 씀)에서는 빼고 배포(production)에서만 켠다.
const isProd = process.env.NODE_ENV === "production";
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js가 넣는 인라인 스크립트 때문에 필요(nonce 방식으로 바꾸면 더 엄격해짐)
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
