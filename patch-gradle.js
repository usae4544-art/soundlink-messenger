import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Patching Android Gradle files for Kotlin version alignment (2.2.20) and conflict resolution...");

const gradlePropsPath = path.join('android', 'gradle.properties');
if (fs.existsSync(gradlePropsPath)) {
  let props = fs.readFileSync(gradlePropsPath, 'utf8');
  if (!props.includes('kotlinVersion')) {
    props += '\nkotlinVersion=2.2.20\n';
  } else {
    props = props.replace(/kotlinVersion=.*/g, 'kotlinVersion=2.2.20');
  }
  fs.writeFileSync(gradlePropsPath, props);
}

const rootGradlePath = path.join('android', 'build.gradle');
if (fs.existsSync(rootGradlePath)) {
  let content = fs.readFileSync(rootGradlePath, 'utf8');
  content = content.replace(/1\.9\.24/g, '2.2.20').replace(/2\.0\.21/g, '2.2.20');
  if (!content.includes('resolutionStrategy')) {
    const resolutionBlock = `
allprojects {
    configurations.all {
        resolutionStrategy {
            force 'org.jetbrains.kotlin:kotlin-stdlib:2.2.20'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.2.20'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.2.20'
            force 'org.jetbrains.kotlin:kotlin-reflect:2.2.20'
            
            eachDependency { details ->
                if (details.requested.group == 'org.jetbrains.kotlin') {
                    details.useVersion '2.2.20'
                }
            }
        }
    }
}
`;
    content += resolutionBlock;
  }
  fs.writeFileSync(rootGradlePath, content);
}

console.log("Gradle patching completed successfully for Kotlin 2.2.20.");
