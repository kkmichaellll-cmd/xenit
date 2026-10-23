import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {'/api/workspace/*':['./public/fonts/letter-regular.ttf']},
};

export default nextConfig;
