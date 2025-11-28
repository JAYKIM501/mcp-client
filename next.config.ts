import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // 빌드 시 경고를 무시하고 계속 진행
    ignoreDuringBuilds: false,
  },
  typescript: {
    // 빌드 시 타입 에러가 있어도 계속 진행 (경고만 있는 경우)
    ignoreBuildErrors: false,
  },
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
