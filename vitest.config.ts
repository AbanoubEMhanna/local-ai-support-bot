export default {
  test: {
    environment: "node",
    globals: true,
    include: [
      "apps/**/*.test.ts",
      "packages/**/*.test.ts"
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**"
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"]
    }
  }
};
