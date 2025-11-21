import os
import urllib.request
import json
import ssl

# Allow legacy SSL if needed (for some older python envs)
ssl._create_default_https_context = ssl._create_unverified_context

FONTS_DIR = os.path.join(os.path.dirname(__file__), 'fonts')
os.makedirs(FONTS_DIR, exist_ok=True)

# Mapping: internal_name -> (google_font_id, variant_id, filename)
FONT_MAP = {
    'sans': ('roboto', '700', 'Roboto-Bold.ttf'),
    'lobster': ('lobster', 'regular', 'Lobster-Regular.ttf'),
    'pacifico': ('pacifico', 'regular', 'Pacifico-Regular.ttf'),
    'greatvibes': ('great-vibes', 'regular', 'GreatVibes-Regular.ttf'),
    'allura': ('allura', 'regular', 'Allura-Regular.ttf'),
    'alexbrush': ('alex-brush', 'regular', 'AlexBrush-Regular.ttf'),
    'dancingscript': ('dancing-script', '700', 'DancingScript-Bold.ttf'),
    'satisfy': ('satisfy', 'regular', 'Satisfy-Regular.ttf'),
    'baloo2': ('baloo-2', '700', 'Baloo2-Bold.ttf'),
    'fredoka': ('fredoka', '600', 'Fredoka-SemiBold.ttf'), # 600 is SemiBold, good for 3D
    'rounded': ('varela-round', 'regular', 'VarelaRound-Regular.ttf'),
    'serif': ('playfair-display', '700', 'PlayfairDisplay-Bold.ttf')
}

def get_font_url(font_id, variant):
    """
    Fetches the TTF URL from gwfh.mranftl.com API.
    """
    api_url = f"https://gwfh.mranftl.com/api/fonts/{font_id}"
    try:
        with urllib.request.urlopen(api_url, timeout=5) as response:
            data = json.loads(response.read().decode())
            
        for v in data.get('variants', []):
            if v['id'] == variant:
                return v.get('ttf')
                
        # Fallback to regular if requested variant not found
        for v in data.get('variants', []):
            if v['id'] == 'regular':
                return v.get('ttf')
                
        return None
    except Exception as e:
        print(f"Error fetching API for {font_id}: {e}")
        return None

def get_font_path(font_name):
    """
    Returns the path to the requested font. Downloads it if not present.
    """
    if font_name not in FONT_MAP:
        font_name = 'sans' # Fallback
        
    font_id, variant, filename = FONT_MAP[font_name]
    font_path = os.path.join(FONTS_DIR, filename)
    
    if not os.path.exists(font_path):
        print(f"Downloading font: {font_name} ({filename})...")
        try:
            url = get_font_url(font_id, variant)
            if url:
                print(f"  Source: {url}")
                urllib.request.urlretrieve(url, font_path)
            else:
                print(f"  Failed to get URL for {font_name}")
                return None
        except Exception as e:
            print(f"Failed to download font {font_name}: {e}")
            return None
            
    return font_path
