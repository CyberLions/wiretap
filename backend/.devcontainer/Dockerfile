# Use lightweight Alpine image for faster builds
FROM node:22-bullseye

# Set working directory and environment variables
WORKDIR /app
ENV NODE_ENV=development
ENV HOST=0.0.0.0

# Install additional packages for better file watching
RUN apt-get update && apt-get install -y \
    inotify-tools \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for dependency caching
#COPY package*.json ./

# Install dependencies (use npm ci for production)
#RUN npm install --include=dev

# Copy source code (excluded via .dockerignore)
#COPY . .

# Expose dev server port
EXPOSE 80

# Start Vite dev server with hot reload and improved file watching
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--watch"]
