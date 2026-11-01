import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['imapflow', 'mailparser', 'nodemailer'],
  outputFileTracingIncludes: {'/api/workspace/*':['./public/fonts/letter-regular.ttf']},
};

export default nextConfig;
