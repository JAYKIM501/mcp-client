import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    // 외부 이미지 허용
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    // 기존 domains 설정 (deprecated but kept for compatibility)
    unoptimized: true, // 외부 이미지 최적화 비활성화 (다양한 소스 지원)
  },
};

export default nextConfig;
