name: Build Android APK

on:
  push:
    branches: [ "main" ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        java-version: '17'
        distribution: 'temurin'

    - name: Find and setup gradlew
      run: find . -name "gradlew" -exec chmod +x {} + || true

    - name: Generate dummy debug keystore
      run: keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "C=US, O=Android, CN=Android Debug"

    - name: Build Debug APK
      run: |
        if [ -f "gradlew" ]; then
          ./gradlew assembleDebug
        elif [ -d "android" ] && [ -f "android/gradlew" ]; then
          cd android && ./gradlew assembleDebug
        else
          gradle assembleDebug
        fi

    - name: Upload all APKs
      uses: actions/upload-artifact@v4
      with:
        name: my-android-app
        path: '**/*.apk'
