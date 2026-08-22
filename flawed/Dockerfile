# Production stage - use pre-built dist
FROM node:22-alpine

WORKDIR /app

# Copy pre-built frontend (from local build)
COPY dist ./dist
COPY server ./server
COPY package.json ./

# Install production dependencies only
RUN npm install --legacy-peer-deps --omit=dev @anthropic-ai/sdk

# Expose port
EXPOSE 5274

# Set environment
ENV NODE_ENV=production
ENV PORT=5274

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5274', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "server/start-docker.cjs"]
