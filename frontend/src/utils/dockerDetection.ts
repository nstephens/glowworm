/**
 * Docker Detection Utility
 * Determines if the application is running in a Docker environment
 */

export interface DockerEnvironment {
  isDocker: boolean;
  isDockerCompose: boolean;
  environment: 'docker' | 'traditional' | 'unknown';
}

/**
 * Detect if the application is running in Docker
 * This is determined by checking for Docker-specific environment variables
 * that are set by the backend when running in Docker containers
 */
export async function detectDockerEnvironment(): Promise<DockerEnvironment> {
  try {
    // Check if we can access the setup status endpoint
    // Docker deployments have different setup behavior
    const response = await fetch('/api/setup/status');
    const data = await response.json();
    
    // If we get a response, check for Docker-specific indicators
    // Docker deployments typically have environment variables set
    // and different bootstrap behavior
    
    // Check if this is a Docker deployment by looking at the setup status
    // Docker deployments usually have is_configured=true but may need admin creation
    const isDocker = data.is_configured && !data.needs_bootstrap;
    const isDockerCompose = isDocker; // For now, treat Docker and Docker Compose the same
    
    return {
      isDocker,
      isDockerCompose,
      environment: isDocker ? 'docker' : 'traditional'
    };
  } catch (error) {
    console.warn('Could not detect Docker environment:', error);
    return {
      isDocker: false,
      isDockerCompose: false,
      environment: 'unknown'
    };
  }
}

/**
 * Check if a specific setting should be disabled in Docker
 */
export function shouldDisableInDocker(settingKey: string, dockerEnv: DockerEnvironment): boolean {
  if (!dockerEnv.isDocker) {
    return false;
  }
  
  // Settings that should be disabled in Docker
  const dockerDisabledSettings = [
    // Server ports are managed by Docker Compose
    'backend_port',
    'frontend_port',
    
    // Database settings are managed by Docker environment variables
    'mysql_host',
    'mysql_port', 
    'mysql_root_user',
    'mysql_root_password',
    'app_db_user',
    'app_db_password',
    
    // File paths are managed by Docker volumes
    'upload_directory'
  ];
  
  return dockerDisabledSettings.includes(settingKey);
}

/**
 * Get a human-readable reason why a setting is disabled
 */
export function getDisabledReason(settingKey: string, dockerEnv: DockerEnvironment): string {
  if (!dockerEnv.isDocker) {
    return '';
  }
  
  const reasons: Record<string, string> = {
    'backend_port': 'Backend port is managed by Docker Compose',
    'frontend_port': 'Frontend port is managed by Docker Compose',
    'mysql_host': 'Database host is managed by Docker environment variables',
    'mysql_port': 'Database port is managed by Docker environment variables',
    'mysql_root_user': 'Database credentials are managed by Docker environment variables',
    'mysql_root_password': 'Database credentials are managed by Docker environment variables',
    'app_db_user': 'Database credentials are managed by Docker environment variables',
    'app_db_password': 'Database credentials are managed by Docker environment variables',
    'upload_directory': 'Upload directory is managed by Docker volumes'
  };
  
  return reasons[settingKey] || 'This setting is managed by Docker';
}

