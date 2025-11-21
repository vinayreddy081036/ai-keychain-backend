import subprocess

def render_stl(scad_path, output_path):
    """
    Renders .scad to .stl using OpenSCAD CLI.
    """
    # Ensure output directory exists
    # Run openscad
    # openscad -o output.stl input.scad
    cmd = ["openscad", "-o", output_path, scad_path]
    print(f"Running OpenSCAD: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"OpenSCAD Error: {result.stderr}")
        raise RuntimeError(f"OpenSCAD failed: {result.stderr}")
        
    return output_path
