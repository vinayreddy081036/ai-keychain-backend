import cv2
import numpy as np
from stl import mesh
import mapbox_earcut as earcut
from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.ops import unary_union
from shapely.affinity import translate

def process_image_to_mesh(image_path, output_path, text=None, shape_type='cutout', 
                          text_thickness=3.0, base_thickness=2.0, base_padding=5.0, text_dilation=0.0,
                          outline_type='bubble', hole_radius=3.0, hole_position='top', 
                          hole_x_off=0, hole_y_off=0):
    """
    Converts an image to a 3D STL mesh with advanced layering.
    """
    # 1. Load and preprocess image
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("Could not load image")
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Threshold
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Morphological closing to fill small gaps in thin fonts
    kernel = np.ones((3,3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    
    # Find contours for TEXT/FOREGROUND
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        raise ValueError("No shape found in image")
        
    # Process contours into Shapely polygons
    text_polygons = []
    for c in contours:
        # Lower threshold to catch small punctuation/dots
        if cv2.contourArea(c) < 10: continue 
        
        epsilon = 0.002 * cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, epsilon, True)
        if len(approx) < 3: continue
        
        points = approx.reshape(-1, 2)
        points[:, 1] = -points[:, 1] # Flip Y
        poly = Polygon(points)
        if not poly.is_valid: poly = poly.buffer(0)
        text_polygons.append(poly)
    
    if not text_polygons:
        raise ValueError("No valid shapes found")
        
    text_shape = unary_union(text_polygons)
    
    # Center the shape
    minx, miny, maxx, maxy = text_shape.bounds
    center_x = (minx + maxx) / 2
    center_y = (miny + maxy) / 2
    
    if isinstance(text_shape, MultiPolygon):
        translated_parts = [translate_polygon(p, -center_x, -center_y) for p in text_shape.geoms]
        text_shape = MultiPolygon(translated_parts)
    else:
        text_shape = translate_polygon(text_shape, -center_x, -center_y)
    
    # ... (Contour processing) ...
    
    # 3. Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Create Polygon from contours
    polys = []
    for cnt in contours:
        if len(cnt) < 3: continue
        # Flip Y axis to match 3D coordinates (Image Y is down, 3D Y is up)
        # Also scale down slightly to reasonable units if needed, but mainly flip Y
        points = cnt.reshape(-1, 2)
        points[:, 1] = -points[:, 1] # Flip Y
        
        poly = Polygon(points)
        if not poly.is_valid:
            poly = poly.buffer(0)
        polys.append(poly)
        
    if not polys:
        raise ValueError("No valid shapes found")
        
    text_shape = unary_union(polys)
    
    # Center the shape
    minx, miny, maxx, maxy = text_shape.bounds
    center_x = (minx + maxx) / 2
    center_y = (miny + maxy) / 2
    text_shape = translate(text_shape, -center_x, -center_y)
    
    # Apply Text Dilation (Width/Boldness)
    px_per_mm = 11.8 # Approx 300 DPI
    
    if text_dilation > 0:
        # Dilation with round join/cap for smoothness
        text_shape = text_shape.buffer(text_dilation * px_per_mm, join_style=1, cap_style=1)
    
    # Generate Base Shape
    base_shape = None
    
    if outline_type == 'bubble':
        # Create a smooth bubble around the text
        # 1. Buffer outwards by padding
        # 2. Buffer inwards slightly to smooth sharp crevices (optional, but helps)
        # join_style=1 (ROUND), cap_style=1 (ROUND)
        
        padding_px = base_padding * px_per_mm
        
        # Large buffer to merge everything
        merged_shape = text_shape.buffer(padding_px, join_style=1, cap_style=1)
        
        # Optional: Negative buffer to tighten up deep crevices if needed, 
        # but for "bubble" we usually want it filled. 
        # If the user wants "around letters" tightly, we keep it as is or do a small open/close.
        
        # Ensure it's a valid polygon
        if not merged_shape.is_valid:
            merged_shape = merged_shape.buffer(0)
            
        base_shape = merged_shape
        
    elif outline_type == 'rect':
        minx, miny, maxx, maxy = text_shape.bounds
        padding_px = base_padding * px_per_mm
        box = Polygon([
            (minx - padding_px, miny - padding_px),
            (maxx + padding_px, miny - padding_px),
            (maxx + padding_px, maxy + padding_px),
            (minx - padding_px, maxy + padding_px)
        ])
        # Round the corners of the rect slightly
        base_shape = box.buffer(padding_px * 0.2, join_style=1)
        
    else: # None or cutout
        # For cutout, base is same as text but we might want a backing?
        # If 'none', we might just be printing text. 
        # But usually 'cutout' implies a shape WITH text cut out.
        # Let's assume 'none' means just the text mesh (no base).
        base_shape = None

    # Add Keyring Hole
    if base_shape and hole_position != 'none':
        hole_r_px = hole_radius * px_per_mm
        hole_margin = hole_r_px * 2.5 # Enough plastic around hole
        
        minx, miny, maxx, maxy = base_shape.bounds
        
        # Calculate hole center
        hx, hy = 0, 0
        
        if hole_position == 'top':
            hx = (minx + maxx) / 2 + (hole_x_off * px_per_mm)
            hy = maxy + hole_r_px + (hole_y_off * px_per_mm) # Center is above the top edge
            
        elif hole_position == 'left':
            hx = minx - hole_r_px + (hole_x_off * px_per_mm)
            hy = (miny + maxy) / 2 + (hole_y_off * px_per_mm)
        
        elif hole_position == 'right':
            hx = maxx + hole_r_px + (hole_x_off * px_per_mm)
            hy = (miny + maxy) / 2 + (hole_y_off * px_per_mm)
            
        elif hole_position == 'bottom':
            hx = (minx + maxx) / 2 + (hole_x_off * px_per_mm)
            hy = miny - hole_r_px + (hole_y_off * px_per_mm)
            
        elif hole_position == 'custom':
            hx = float(hole_x_off) * px_per_mm
            hy = float(hole_y_off) * px_per_mm
            
        # Create the tab for the hole
        # A circle at hx, hy with radius = hole_margin
        hole_tab = Point(hx, hy).buffer(hole_margin, join_style=1, cap_style=1)
        
        # Merge tab with base
        base_shape = unary_union([base_shape, hole_tab])
        
        # Create the actual hole cutout
        hole_cutout = Point(hx, hy).buffer(hole_r_px, join_style=1, cap_style=1)
        
        # Subtract hole from base
        base_shape = base_shape.difference(hole_cutout)

    # Extrude Meshes
    meshes = []

    # 1. Base Mesh
    if base_shape:
        b_verts, b_faces = triangulate_polygon(base_shape)
        # Base goes from z=0 to z=base_thickness
        base_mesh = extrude_faces(b_verts, b_faces, base_thickness)
        meshes.append(base_mesh)

    # 2. Text Mesh
    # Text sits ON TOP of base? Or goes through?
    # Usually on top. z = base_thickness to z = base_thickness + text_thickness
    t_verts, t_faces = triangulate_polygon(text_shape)
    
    # We need a custom extrude that supports Z-offset
    # Or just extrude normally and translate the mesh in Z
    text_mesh = extrude_faces(t_verts, t_faces, text_thickness)
    text_mesh.translate([0, 0, base_thickness]) # Move up
    meshes.append(text_mesh)

    # Combine meshes
    combined_mesh = mesh.Mesh(np.concatenate([m.data for m in meshes]))
    combined_mesh.save(output_path)
    
    # Save separate parts for viewer
    base_path = output_path.replace('.stl', '_base.stl')
    text_path = output_path.replace('.stl', '_text.stl')
    
    if len(meshes) > 0:
        # Base is usually index 0 if it exists
        # But if outline_type is none, we might only have text?
        # Let's be safe.
        if base_shape:
            meshes[0].save(base_path)
        
        if len(meshes) > 1:
            meshes[1].save(text_path)
        elif not base_shape:
            # Only text
            meshes[0].save(text_path)
            
    return output_path

def translate_polygon(poly, dx, dy):
    return Polygon([(x + dx, y + dy) for x, y in poly.exterior.coords])

def triangulate_polygon(polygon):
    """
    Triangulates a Shapely polygon (with holes) using mapbox_earcut.
    Returns (vertices, faces).
    """
    # Prepare data for earcut
    # Earcut expects a flat array of coordinates and an array of hole indices
    
    if isinstance(polygon, MultiPolygon):
        # Handle multipolygon by processing each part and merging
        all_vertices = []
        all_faces = []
        v_offset = 0
        for p in polygon.geoms:
            v, f = triangulate_single_polygon(p)
            all_vertices.extend(v)
            all_faces.extend([face + v_offset for face in f])
            v_offset += len(v)
        return np.array(all_vertices), np.array(all_faces)
    else:
        return triangulate_single_polygon(polygon)

def triangulate_single_polygon(polygon):
    exterior = list(polygon.exterior.coords)[:-1] # remove duplicate last point
    holes = [list(h.coords)[:-1] for h in polygon.interiors]
    
    vertices = exterior
    # Calculate ring counts/ends for mapbox_earcut
    # It seems to expect the end index of each ring
    rings_ends = []
    current_end = len(exterior)
    rings_ends.append(current_end)
    
    for h in holes:
        vertices.extend(h)
        current_end += len(h)
        rings_ends.append(current_end)
        
    # Prepare vertices for earcut (N, 2)
    vertices_arr = np.array(vertices, dtype=np.float32)
    rings_ends_arr = np.array(rings_ends, dtype=np.uint32)
    
    # Run earcut
    triangles = earcut.triangulate_float32(vertices_arr, rings_ends_arr)
    
    # Reshape triangles to (N, 3)
    faces = triangles.reshape(-1, 3)
    
    return np.array(vertices), faces

def extrude_faces(vertices, faces, height):
    """
    Extrudes 2D faces into a 3D mesh.
    """
    # Create 3D vertices (z=0 and z=height)
    n_verts = len(vertices)
    bottom_verts = np.column_stack([vertices, np.zeros(n_verts)])
    top_verts = np.column_stack([vertices, np.full(n_verts, height)])
    
    all_verts = np.vstack([bottom_verts, top_verts])
    
    # Create faces
    # 1. Bottom faces (reversed winding for correct normal)
    bottom_faces = faces[:, ::-1]
    
    # 2. Top faces (offset by n_verts)
    top_faces = faces + n_verts
    
    # 3. Side faces (walls)
    # We need edges.
    # For now, let's just iterate over all edges in the faces and find boundary edges?
    # Or simpler: iterate over the original polygon rings.
    # But we only have vertices/faces here.
    # Let's assume the vertices are ordered in rings as we constructed them.
    # Actually, we can just build walls between i and i+1 for the exterior ring.
    # But we have holes too.
    # Let's extract edges from faces and find those that only appear once (boundary edges).
    
    edges = {}
    for f in faces:
        for i in range(3):
            v1, v2 = f[i], f[(i+1)%3]
            edge = tuple(sorted((v1, v2)))
            edges[edge] = edges.get(edge, 0) + 1
            
    boundary_edges = [e for e, count in edges.items() if count == 1]
    
    side_faces = []
    for v1_idx, v2_idx in boundary_edges:
        # We need to know the direction to get normals right.
        # The sorted edge lost direction.
        # We can check the original face to see order.
        # But simpler: just add both triangles and let STL fixers handle it? No, bad.
        
        # Re-find the face to check winding
        for f in faces:
            if v1_idx in f and v2_idx in f:
                # Check if v1 -> v2 is the order in the face
                # If so, it's an internal edge if shared, but this is boundary.
                # Wait, for a single triangle (0, 1, 2), edges are 0-1, 1-2, 2-0.
                # If we have 0->1, the wall should be 0->1->1'->0'.
                
                # Let's find the index of v1
                idx1 = np.where(f == v1_idx)[0][0]
                idx2 = np.where(f == v2_idx)[0][0]
                
                if (idx1 + 1) % 3 == idx2:
                    # v1 -> v2
                    # Wall: v1, v2, v2+n, v1+n
                    # Tri 1: v1, v2, v2+n
                    # Tri 2: v1, v2+n, v1+n
                    side_faces.append([v1_idx, v2_idx, v2_idx + n_verts])
                    side_faces.append([v1_idx, v2_idx + n_verts, v1_idx + n_verts])
                else:
                    # v2 -> v1
                    # Wall: v2, v1, v1+n, v2+n
                    side_faces.append([v2_idx, v1_idx, v1_idx + n_verts])
                    side_faces.append([v2_idx, v1_idx + n_verts, v2_idx + n_verts])
                break
                
    all_faces = np.vstack([bottom_faces, top_faces, side_faces])
    
    # Create the mesh object
    stl_mesh = mesh.Mesh(np.zeros(all_faces.shape[0], dtype=mesh.Mesh.dtype))
    for i, f in enumerate(all_faces):
        for j in range(3):
            stl_mesh.vectors[i][j] = all_verts[f[j]]
            
    return stl_mesh
