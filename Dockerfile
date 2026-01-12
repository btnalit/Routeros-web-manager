# RouterOS Web Manager - Multi-stage Dockerfile
# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Copy patches directory for patch-package
COPY backend/patches ./patches/

# Install dependencies (postinstall will apply patches)
RUN npm ci

# Copy backend source
COPY backend/ ./

# Build backend
RUN npm run build

# Stage 3: Production Image
FROM node:20-alpine AS production

# Install tini for proper signal handling
RUN apk add --no-cache tini

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/

# Install production dependencies (skip postinstall since patch-package is devDep)
RUN cd backend && npm ci --omit=dev --ignore-scripts

# Copy patched node_modules from backend-builder (already has patches applied)
COPY --from=backend-builder /app/backend/node_modules/node-routeros ./backend/node_modules/node-routeros

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Copy built frontend to backend public directory
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Create data directory for config persistence
RUN mkdir -p /app/backend/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3099

# Expose port
EXPOSE 3099

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3099/api/connection/status || exit 1

# Set stop signal
STOPSIGNAL SIGTERM

# Start the application with tini as init
WORKDIR /app/backend
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
