# Build stage
FROM node:23-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install envsubst
RUN apk add --no-cache bash gettext

# Copy nginx configuration
COPY .docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the env.js template
COPY .docker/env.js.template /usr/share/nginx/html/env.js.template

# Copy entrypoint script and ensure proper line endings
COPY .docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && \
    sed -i 's/\r$//' /docker-entrypoint.sh && \
    cat /docker-entrypoint.sh

# Environment variables with defaults
ENV VITE_API_URL="http://localhost:6011"
ENV VITE_APP_TITLE="Wiretap"
ENV VITE_FRONTEND_URL="http://localhost"

# Expose web port
EXPOSE 80

# Use custom entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
