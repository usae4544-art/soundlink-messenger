const fs = require('fs');
const path = require('path');

console.log("Patching Android Gradle files for Kotlin version alignment and conflict resolution...");

const gradlePropsPath = path.join('android', 'gradle.properties');
if (fs.existsSync(gradlePropsPath)) {
  let props = fs.readFileSync(gradlePropsPath, 'utf8');
  if (!props.includes('kotlinVersion')) {
    props += '\nkotlinVersion=1.9.24\n';
  } else {
    props = props.replace(/kotlinVersion=.*/g, 'kotlinVersion=1.9.24');
  }
  fs.writeFileSync(gradlePropsPath, props);
}

const rootGradlePath = path.join('android', 'build.gradle');
if (fs.existsSync(rootGradlePath)) {
  let content = fs.readFileSync(rootGradlePath, 'utf8');
  if (!content.includes('resolutionStrategy')) {
    const resolutionBlock = `
allprojects {
    configurations.all {
        resolutionStrategy {
            force 'org.jetbrains.kotlin:kotlin-stdlib:1.9.24'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.9.24'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.24'
            force 'org.jetbrains.kotlin:kotlin-reflect:1.9.24'
            
            eachDependency { details ->
                if (details.requested.group == 'org.jetbrains.kotlin') {
                    details.useVersion '1.9.24'
                }
            }
        }
    }
}
`;
    content += resolutionBlock;
    fs.writeFileSync(rootGradlePath, content);
  }
}

console.log("Gradle patching completed successfully.");
