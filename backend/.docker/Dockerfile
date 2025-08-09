# Use the official Node.js 14 image as the base image
FROM node:22.1-bullseye

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the project files to the working directory
COPY . .

# Expose a port (if your application needs it)
EXPOSE 3000

# Start the application
CMD [ "node", "index.js" ]