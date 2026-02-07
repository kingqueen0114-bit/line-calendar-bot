# Dev Agent - Autonomous Development Server
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source files
COPY src/dev-agent/ ./src/dev-agent/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/').then(r => process.exit(r.ok ? 0 : 1))"

# Start the server
CMD ["node", "src/dev-agent/server.js"]
