import os
import re
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def get_svg_dimensions(svg_path):
    """
    Parses the SVG file to find its width and height (viewBox).
    Returns (width, height).
    """
    try:
        with open(svg_path, 'r') as f:
            content = f.read()
            # Look for viewBox="0 0 W H"
            match = re.search(r'viewBox=["\']\s*0\s*0\s*([\d.]+)\s*([\d.]+)\s*["\']', content)
            if match:
                return float(match.group(1)), float(match.group(2))
            
            # Fallback: look for width and height attributes
            w_match = re.search(r'width=["\']([\d.]+)["\']', content)
            h_match = re.search(r'height=["\']([\d.]+)["\']', content)
            if w_match and h_match:
                return float(w_match.group(1)), float(h_match.group(2))
    except Exception as e:
        print(f"Error reading SVG dimensions: {e}")
    
    return 100, 100 # Default fallback

def generate_scad(svg_path, text, shape_type, use_ai, engrave_mode, output_dir, file_id):
    """
    Generates an OpenSCAD script.
    """
    scad_path = os.path.join(output_dir, f"{file_id}.scad")
    svg_filename = os.path.basename(svg_path)
    
    width, height = get_svg_dimensions(svg_path)
    
    # Basic Template Logic
    # Center the object
    # Add a ring at the top
    
    ring_radius = 4
    hole_radius = 2.5
    thickness = 3
    
    # Calculate ring position (top center)
    ring_x = width / 2
    ring_y = height + ring_radius - 2 # Overlap slightly
    
    # Text logic
    text_scad = ""
    if text:
        # Simple text placement: centered, below or on top?
        # Let's put it below for the basic template
        text_y = -10
        if engrave_mode == 'engrave':
             text_scad = f"""
             translate([{width/2}, {text_y}, {thickness/2}]) 
             linear_extrude(height=2) 
             text("{text}", size=8, halign="center", valign="center");
             """
        else: # emboss
             text_scad = f"""
             translate([{width/2}, {text_y}, {thickness}]) 
             linear_extrude(height=1) 
             text("{text}", size=8, halign="center", valign="center");
             """

    scad_content = ""

    if use_ai:
        # AI Generation
        system_prompt = """You are an expert OpenSCAD programmer. 
        Generate valid OpenSCAD code for a 3D printable keychain.
        The user will provide the SVG filename, dimensions, text, and preferences.
        You MUST output ONLY the OpenSCAD code, no markdown formatting, no explanations.
        Ensure the code imports the SVG file correctly using import("filename.svg").
        The keychain must have a hole for a ring.
        """
        
        user_prompt = f"""
        Create a keychain using the SVG file "{svg_filename}".
        SVG Dimensions: {width}x{height}.
        Text to add: "{text}" ({engrave_mode}).
        Shape style: {shape_type}.
        Requirements:
        1. Extrude the SVG to {thickness}mm height.
        2. Add a keyring hole (radius {hole_radius}mm) at an optimal position (usually top).
        3. {engrave_mode.capitalize()} the text "{text}" on the model or below it.
        4. Ensure the model is printable (manifold).
        5. Center the geometry.
        """
        
        try:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2
            )
            scad_content = response.choices[0].message.content
            # Clean up markdown code blocks if present
            scad_content = scad_content.replace("```openscad", "").replace("```", "")
        except Exception as e:
            print(f"AI generation failed: {e}. Falling back to template.")
            use_ai = False # Fallback

    if not use_ai:
        # Fallback / Standard Template
        # We need to handle the text being engraved (subtracted) or embossed (added)
        
        if engrave_mode == 'engrave' and text:
            # Difference
            scad_content = f"""
            difference() {{
                union() {{
                    linear_extrude(height={thickness}) import("{svg_filename}");
                    // Ring
                    translate([{width/2}, {height}, 0]) 
                        linear_extrude(height={thickness}) 
                        difference() {{
                            circle(r={ring_radius});
                            circle(r={hole_radius});
                        }}
                }}
                // Text Engraving
                translate([{width/2}, {height/2}, {thickness-1}]) 
                    linear_extrude(height=2) 
                    text("{text}", size=min({width}/4, 10), halign="center", valign="center");
            }}
            """
        else:
            # Union (Emboss or no text)
            scad_content = f"""
            union() {{
                linear_extrude(height={thickness}) import("{svg_filename}");
                // Ring
                translate([{width/2}, {height}, 0]) 
                    linear_extrude(height={thickness}) 
                    difference() {{
                        circle(r={ring_radius});
                        circle(r={hole_radius});
                    }}
                
                // Text Emboss
                {f'''
                translate([{width/2}, {height/2}, {thickness}]) 
                    linear_extrude(height=1) 
                    text("{text}", size=min({width}/4, 10), halign="center", valign="center");
                ''' if text else ''}
            }}
            """

    # Write to file
    with open(scad_path, 'w') as f:
        f.write(scad_content)
        
    return scad_path
