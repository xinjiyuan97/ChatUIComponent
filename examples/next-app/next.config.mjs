/** @type {import('next').NextConfig} */
const nextConfig = {
  /* The workspace packages are published as ESM+CJS with `"use client"` already in the
   * bundle, so they need no transpilation here. This example deliberately consumes
   * `dist` through node_modules rather than aliasing to source — that is the path a real
   * consumer takes, and it is the only way this smoke test proves anything. */
  reactStrictMode: true,
}

export default nextConfig
