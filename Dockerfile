# Multi-stage production image for InspireWorks Plivo IVR Application
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy dependency definitions first to maximize Docker layer caching
COPY backend/package*.json ./backend/

# Install dependencies inside the Linux container
RUN cd backend && npm install --omit=dev --no-audit

# Copy application backend source code and frontend client assets
COPY backend ./backend
COPY client ./client

# Production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose HTTP port
EXPOSE 3000

# Built-in container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application server
CMD ["node", "backend/index.js"]
