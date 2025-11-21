import os
import json
import re

class AIService:
    def __init__(self):
        pass

    def get_client(self, api_key):
        from openai import OpenAI
        return OpenAI(api_key=api_key)

    def extract_json_from_text(self, text):
        try:
            if "```json" in text:
                json_str = text.split("```json")[1].split("```")[0]
                return json.loads(json_str)
            elif "{" in text and "}" in text:
                match = re.search(r'\{.*\}', text, re.DOTALL)
                if match:
                    return json.loads(match.group(0))
        except Exception as e:
            print(f"JSON Extraction Error: {e}")
        return None

    def generate_design_params(self, prompt, api_key):
        """
        Single-shot generation from a prompt.
        """
        client = self.get_client(api_key)
        
        system_prompt = """
        You are a 3D printing expert. Interpret the user's request for a keychain design and return a JSON object with these parameters:
        - text_content: The text to put on the keychain (if implied by the user, e.g. "for mom" -> "Mom"). If not specified, return null.
        - font: One of [lobster, pacifico, greatvibes, allura, alexbrush, dancingscript, satisfy, baloo2, fredoka, sans, serif]
        - text_thickness: float (1.0 to 5.0)
        - base_thickness: float (1.0 to 5.0)
        - base_padding: float (1.0 to 20.0)
        - text_dilation: float (0.0 to 2.0) - 0.0 is normal, 1.0 is bold/thick
        - outline_type: One of [bubble, rect, none]
        - hole_position: One of [top, left, right, none]
        - hole_radius: float (1.0 to 10.0)
        - text_color: Hex color string (e.g. "#ff0000")
        - base_color: Hex color string (e.g. "#000000")
        - reasoning: A short sentence explaining your design choices.
        
        Example: "Make a blue keychain for my boss" -> 
        {
            "text_content": "BOSS", 
            "font": "sans", 
            "text_thickness": 4.0, 
            "base_thickness": 3.0, 
            "base_padding": 6.0, 
            "text_dilation": 0.2,
            "outline_type": "rect", 
            "hole_position": "left",
            "hole_radius": 3.0,
            "text_color": "#ffffff",
            "base_color": "#0000ff",
            "reasoning": "I chose a bold sans font and rectangular shape for a professional look."
        }
        """
        
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" }
        )
        
        return json.loads(completion.choices[0].message.content)

    def chat(self, messages, api_key):
        """
        Interactive chat with the user.
        """
        client = self.get_client(api_key)
        
        system_prompt = """
        You are an expert 3D printing design assistant for a keychain creator app.
        Your goal is to help the user design a custom keychain by asking clarifying questions.
        
        The user can control:
        - Text (what it says)
        - Font (lobster, pacifico, greatvibes, allura, alexbrush, dancingscript, satisfy, baloo2, fredoka, sans, serif)
        - Colors (Text and Base hex codes)
        - Shape (Bubble outline, Rectangle, or None)
        - Size/Thickness (Text thickness, Base thickness, Padding, Text Boldness/Dilation)
        - Hole (Position: top/left/right, Size: 1-10mm)
        
        INTERACTION FLOW:
        1. Ask the user what they want to make.
        2. If they give a vague request (e.g. "a keychain for mom"), ask about colors, font style, or shape.
        3. Be helpful and suggest combinations (e.g. "For a cute look, maybe the Fredoka font with a bubble outline?").
        4. When you have enough information to form a complete design, OR if the user explicitly asks to generate it, you MUST include a special JSON block at the END of your message.
        
        JSON FORMAT:
        ```json
        {
            "text_content": "MOM",
            "font": "fredoka",
            "text_color": "#ff0099",
            "base_color": "#ffffff",
            "outline_type": "bubble",
            "text_thickness": 4.0,
            "base_thickness": 3.0,
            "base_padding": 5.0,
            "text_dilation": 0.5,
            "hole_position": "top",
            "hole_radius": 3.0
        }
        ```
        
        Always keep your conversational response separate from the JSON. The JSON triggers the UI update.
        """
        
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=full_messages
        )
        
        reply = completion.choices[0].message.content
        config = self.extract_json_from_text(reply)
        
        # Clean reply
        if "```json" in reply:
            reply = reply.split("```json")[0].strip()
            
        return reply, config
