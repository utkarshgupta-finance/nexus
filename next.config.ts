import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next's own default Server Action body limit is exactly 1 MB, the
      // same number this app's own document-upload validation
      // (MAX_ATTACHMENT_BYTES, src/features/customer-onboarding/domain/documents.ts)
      // uses as its max file size. With zero headroom for the surrounding
      // multipart/form-data overhead (boundaries, field names, other form
      // fields sent in the same action call), a file at exactly the
      // advertised "Max 1 MB" limit was rejected by the framework with a
      // generic body-size error before the app's own, friendlier
      // validation ever ran. Raised to give real headroom above the app's
      // own ceiling, so the app's validation (not the framework's) is what
      // a user actually sees.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
