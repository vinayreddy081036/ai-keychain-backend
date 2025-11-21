import os
import time
import json
import uuid
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from mesh_generator import process_image_to_mesh

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

UPLOAD_FOLDER = '/tmp/uploads'
PROCESSING_FOLDER = '/tmp/processing'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSING_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB limit

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        filename = secure_filename(file.filename)
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(filename)[1]
        saved_filename = f"{file_id}{ext}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_filename)
        file.save(file_path)
        
        return jsonify({
            'message': 'File uploaded successfully',
            'file_id': file_id,
            'filename': saved_filename
        })

from font_manager import get_font_path
from PIL import Image, ImageDraw, ImageFont

def create_text_image(text, output_path, font_name='sans'):
    """
    Creates a high-res image of the text for contour tracing.
    """
    try:
        # High resolution for better tracing
        img_size = (2000, 2000) # Increased canvas size
        img = Image.new('RGB', img_size, color='white')
        draw = ImageDraw.Draw(img)
        
        font_path = get_font_path(font_name)
        font_size = 200 # Larger font for better details
        
        try:
            font = ImageFont.truetype(font_path, font_size)
        except Exception as e:
            print(f"Font load error: {e}, using default")
            font = ImageFont.load_default()
            
        # Calculate text size
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        # Center text
        x = (img_size[0] - text_width) / 2
        y = (img_size[1] - text_height) / 2
        
        draw.text((x, y), text, font=font, fill='black')
        
        # Crop to text with padding
        padding = 50
        crop_box = (
            max(0, x - padding),
            max(0, y - padding),
            min(img_size[0], x + text_width + padding),
            min(img_size[1], y + text_height + padding)
        )
        img = img.crop(crop_box)
        
        img.save(output_path)
        return True
    except Exception as e:
        print(f"Error creating text image: {e}")
        raise

from ai_service import AIService

@app.route('/api/generate', methods=['POST'])
def generate_model():
    data = request.json
    file_id = data.get('file_id')
    text = data.get('text', '')
    shape_type = data.get('shape', 'cutout')
    use_ai = data.get('use_ai', False)
    api_key = data.get('api_key')
    
    # Advanced Params
    font_name = data.get('font', 'sans')
    text_thickness = float(data.get('text_thickness', 3.0))
    base_thickness = float(data.get('base_thickness', 2.0))
    base_padding = float(data.get('base_padding', 5.0))
    text_dilation = float(data.get('text_dilation', 0.0))
    outline_type = data.get('outline_type', 'bubble')
    hole_position = data.get('hole_position', 'top')
    hole_x = float(data.get('hole_x', 0))
    hole_y = float(data.get('hole_y', 0))
    hole_radius = float(data.get('hole_radius', 3.0))
    ai_prompt = data.get('ai_prompt', '')
    
    ai_response_data = None

    if use_ai and api_key and ai_prompt:
        try:
            ai_service = AIService()
            ai_params = ai_service.generate_design_params(ai_prompt, api_key)
            
            # Apply params
            if ai_params.get('text_content'):
                text = ai_params.get('text_content')
                
            font_name = ai_params.get('font', font_name)
            text_thickness = float(ai_params.get('text_thickness', text_thickness))
            base_thickness = float(ai_params.get('base_thickness', base_thickness))
            base_padding = float(ai_params.get('base_padding', base_padding))
            text_dilation = float(ai_params.get('text_dilation', text_dilation))
            outline_type = ai_params.get('outline_type', outline_type)
            hole_position = ai_params.get('hole_position', hole_position)
            hole_radius = float(ai_params.get('hole_radius', hole_radius))
            
            ai_response_data = {
                'text_color': ai_params.get('text_color'),
                'base_color': ai_params.get('base_color'),
                'reasoning': ai_params.get('reasoning'),
                'text_content': ai_params.get('text_content'),
                'font': font_name,
                'text_thickness': text_thickness,
                'base_thickness': base_thickness,
                'base_padding': base_padding,
                'text_dilation': text_dilation,
                'outline_type': outline_type,
                'hole_position': hole_position,
                'hole_radius': hole_radius
            }
        except Exception as e:
            print(f"AI Error: {e}")
            ai_response_data = {'error': str(e)}

    if not file_id and not text:
        return jsonify({'error': 'Either File or Text is required'}), 400
        
    input_path = None
    
    if file_id:
        # Find the file
        for ext in ['.png', '.jpg', '.jpeg']:
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}{ext}")
            if os.path.exists(temp_path):
                input_path = temp_path
                break
        if not input_path:
            return jsonify({'error': 'File not found'}), 404
    else:
        # Text Only Mode
        file_id = f"text_{uuid.uuid4()}"
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}.png")
        create_text_image(text, input_path, font_name)

    try:
        # Generate STL directly
        stl_filename = f"{file_id}.stl"
        output_path = os.path.join(PROCESSING_FOLDER, stl_filename)
        
        print(f"Processing: {input_path} -> {output_path}")
        print(f"Params: Shape={shape_type}, Text={text}, Font={font_name}, Thick={text_thickness}/{base_thickness}, Pad={base_padding}, Outline={outline_type}, Hole={hole_position}")
        
        process_image_to_mesh(
            input_path, 
            output_path, 
            text=text if file_id else None,
            shape_type=shape_type,
            text_thickness=text_thickness,
            base_thickness=base_thickness,
            base_padding=base_padding,
            text_dilation=text_dilation,
            outline_type=outline_type,
            hole_radius=hole_radius,
            hole_position=hole_position,
            hole_x_off=hole_x,
            hole_y_off=hole_y
        )
        
        response = {
            'message': 'Model generated successfully',
            'stl_url': f"/api/download/{stl_filename}",
            'base_url': f"/api/download/{stl_filename.replace('.stl', '_base.stl')}",
            'text_url': f"/api/download/{stl_filename.replace('.stl', '_text.stl')}",
            'file_id': file_id
        }
        
        if ai_response_data:
            response['ai_params'] = ai_response_data
            
        return jsonify(response)
        
    except Exception as e:
        print(f"Error generating model: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/preview', methods=['POST'])
def preview_image():
    try:
        data = request.json
        text = data.get('text', '')
        font_name = data.get('font', 'sans')
        
        if not text:
            return jsonify({'error': 'Text is required for preview'}), 400
            
        # Generate preview image
        preview_id = f"preview_{uuid.uuid4()}"
        filename = f"{preview_id}.png"
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        create_text_image(text, output_path, font_name)
        
        return jsonify({
            'preview_url': f"/api/download_image/{filename}",
            'file_id': preview_id
        })
    except Exception as e:
        print(f"Preview error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download_image/<filename>', methods=['GET'])
def download_image(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    return send_from_directory(PROCESSING_FOLDER, filename, as_attachment=True)

@app.route('/api/chat', methods=['POST'])
def ai_chat():
    data = request.json
    messages = data.get('messages', [])
    api_key = data.get('api_key')
    
    if not api_key:
        return jsonify({'error': 'API Key required'}), 400
        
    try:
        ai_service = AIService()
        reply, config = ai_service.chat(messages, api_key)
        return jsonify({'reply': reply, 'config': config})
    except Exception as e:
        print(f"Chat Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
