# Use Node.js version 20 as the base runtime image
FROM node:20

# Set the working directory inside the container
# All following commands will run inside /app  of the container
WORKDIR /app

# Copy only dependency files first (package.json + package-lock.json if it exists)
# This helps Docker cache installs and speeds up rebuilds
COPY package*.json ./

# Install all project dependencies inside the container
RUN npm install

# Copy the rest of the application source code into the container
COPY . .

# Default command to start the server when container runs
CMD ["npm", "start"]