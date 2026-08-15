pipeline {
    agent any

    environment {
        // Load configurations
        JWT_SECRET_KEY = 'jenkins_test_pipeline_secret_key'
        DATABASE_URL = 'sqlite+aiosqlite:///:memory:' // Run backend tests in-memory
    }

    stages {
        // Stage 1: Pull Code & Check Environment
        stage('Checkout & Setup') {
            steps {
                echo 'Checking out code from Git Repository...'
                sh 'python --version'
                sh 'node --version'
            }
        }

        // Stage 2: Test Python Backend
        stage('Backend CI (Test)') {
            steps {
                echo 'Installing Python Backend Dependencies...'
                dir('backend') {
                    sh 'python -m pip install --upgrade pip'
                    sh 'pip install -r requirements.txt'
                    echo 'Running Pytest Unit Tests Suite...'
                    sh 'python -m pytest'
                }
            }
        }

        // Stage 3: Build React Frontend (Next.js)
        stage('Frontend CI (Build)') {
            steps {
                echo 'Installing Node Modules...'
                dir('frontend') {
                    sh 'npm install'
                    echo 'Compiling and Building Next.js...'
                    sh 'npm run build'
                }
            }
        }

        // Stage 4: Docker Compilation (CD Build)
        stage('Docker Compilation') {
            steps {
                echo 'Verifying Docker Compose and Packaging Containers...'
                // .env is gitignored, so ensure it exists or docker compose config fails
                sh 'test -f .env || touch .env'
                sh 'docker compose config'
                // sh 'docker compose build' // Uncomment in production to auto-compile
            }
        }
    }

    post {
        success {
            echo '🎉 CI/CD Pipeline successfully executed on Jenkins! All tests passed.'
        }
        failure {
            echo '🚨 Pipeline failed. Please check build console logs for compile or test errors.'
        }
    }
}
