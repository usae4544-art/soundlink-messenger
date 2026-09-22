import os
import zipfile

def zip_project(output_filename, exclude_dirs=['node_modules', '.git', 'dist', '.next']):
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            # modify dirs in place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                filepath = os.path.join(root, file)
                if os.path.abspath(filepath) == os.path.abspath(output_filename):
                    continue
                arcname = os.path.relpath(filepath, '.')
                zipf.write(filepath, arcname)
    print("ZIP created successfully:", output_filename)

if __name__ == '__main__':
    zip_project('soundlink-project.zip')
