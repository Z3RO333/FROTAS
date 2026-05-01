import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  serverExternalPackages: ["@databricks/sql"],
};

export default config;
