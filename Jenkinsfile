pipeline {

    agent any

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out TraderLedgerERP from GitHub...'
                checkout scm
            }
        }

        stage('Docker Build') {
            steps {
                echo 'Building TraderLedgerERP Docker image...'

                bat 'docker build -t traderledgererp:latest .'
            }
        }

        stage('Stop Old Container') {
            steps {
                echo 'Stopping old TraderLedgerERP container if it exists...'

                bat 'docker rm -f traderledgererp >nul 2>&1 || exit /b 0'
            }
        }

        stage('Run Docker Container') {
            steps {
                echo 'Starting TraderLedgerERP container...'

                bat 'docker run -d --name traderledgererp -p 5000:5000 traderledgererp:latest'
            }
        }

        stage('Health Check') {
            steps {
                echo 'Waiting for application to start...'

                bat 'powershell -Command "Start-Sleep -Seconds 10"'

                echo 'Checking TraderLedgerERP health...'

                bat 'curl.exe -f http://localhost:5000/api/health'
            }
        }
    }

    post {

        success {
            echo '======================================'
            echo 'TraderLedgerERP Docker Pipeline PASSED'
            echo 'Application: http://localhost:5000'
            echo '======================================'
        }

        failure {
            echo '======================================'
            echo 'TraderLedgerERP Docker Pipeline FAILED'
            echo 'Check the Jenkins console output.'
            echo '======================================'
        }
    }
}
