import yaml
import os

def generate_env_files():
    # Read config.yaml
    config_path = os.path.join(os.path.dirname(__file__), 'config.yaml')
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    frontend_env_content = f"""# Auto-generated from config.yaml
NEXT_PUBLIC_BACKEND_URL={config['urls']['backend_url']}
NEXT_PUBLIC_FRONTEND_URL={config['urls']['frontend_url']}
NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT={config['project']['google_cloud_project']}
"""

    backend_env_content = f"""# Auto-generated from config.yaml
FRONTEND_URL={config['urls']['frontend_url']}
BACKEND_URL={config['urls']['backend_url']}
GOOGLE_CLOUD_PROJECT={config['project']['google_cloud_project']}
"""

    # Write to frontend/.env.production
    frontend_env_path = os.path.join(os.path.dirname(__file__), 'frontend', '.env.production')
    with open(frontend_env_path, 'w') as f:
        f.write(frontend_env_content)
    
    # Write to frontend/.env.local (for local dev)
    frontend_env_local_path = os.path.join(os.path.dirname(__file__), 'frontend', '.env.local')
    with open(frontend_env_local_path, 'w') as f:
        f.write(frontend_env_content)

    # Write to backend/.env
    backend_env_path = os.path.join(os.path.dirname(__file__), '.env')
    with open(backend_env_path, 'w') as f:
        f.write(backend_env_content)

    print("Successfully generated .env files for frontend and backend from config.yaml")

if __name__ == "__main__":
    generate_env_files()
