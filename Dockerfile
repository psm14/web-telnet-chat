# Node.js production image for node-chat
FROM node:20-alpine AS base

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies using lockfile for reproducibility
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public

# Expose HTTP and Telnet ports
EXPOSE 3000 2323

# Drop privileges
USER node

# Run the server
CMD ["node", "server.js"]

